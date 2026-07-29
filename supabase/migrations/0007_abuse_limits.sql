-- 0007_abuse_limits.sql — database-enforced input and usage limits.
--
-- The web client talks directly to Supabase, so UI validation is only a
-- convenience: a caller can bypass it and use the Data API directly. These
-- constraints and triggers are therefore the authoritative limits.
--
-- Chosen quotas:
--   journal entries: 5,000 per user
--     (about 13.7 years at one entry per day)
--   stored share cards: 200 per user
--     (about 3.8 years at one share per week)
--   share creation rate: 10 per rolling hour
--   album JSON: 64 KiB for new rows
--     (legacy oversized rows may be updated only when they do not grow)
--
-- Change the constants in the trigger functions if the product's normal usage
-- grows beyond these assumptions. Existing rows are checked when the
-- constraints are added. Album JSON is handled by a trigger instead of a
-- CHECK constraint so oversized legacy rows do not block this migration.

-- ---------------------------------------------------------------------------
-- Per-row validation
-- ---------------------------------------------------------------------------

alter table public.journal_entries
  add constraint journal_entries_note_length
  check (char_length(note) <= 2000),
  add constraint journal_entries_theme_length
  check (char_length(theme) between 1 and 64),
  add constraint journal_entries_album_id_length
  check (char_length(album_id) between 1 and 200),
  add constraint journal_entries_date_format
  check (
    date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    and to_char(to_date(date, 'YYYY-MM-DD'), 'YYYY-MM-DD') = date
  );

-- Keep trigger functions outside the exposed public schema. They run as the
-- function owner so quota counts see every row for the target user regardless
-- of the caller's RLS-visible result set.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Album JSON size: maximum 64 KiB for new data
-- ---------------------------------------------------------------------------

create or replace function private.enforce_journal_album_size()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  max_size constant integer := 65536;
  new_size integer;
  old_size integer;
begin
  if new.album is null then
    return new;
  end if;

  new_size := pg_catalog.pg_column_size(new.album);
  if new_size <= max_size then
    return new;
  end if;

  -- Preserve legitimate albums that were already larger than the new limit.
  -- They remain editable only when the stored JSON stays the same size or
  -- shrinks; callers cannot use repeated updates to grow legacy payloads.
  if tg_op = 'UPDATE' and old.album is not null then
    old_size := pg_catalog.pg_column_size(old.album);
    if old_size > max_size and new_size <= old_size then
      return new;
    end if;
  end if;

  raise exception using
    errcode = '23514',
    message = 'journal album JSON size limit exceeded',
    detail = 'New album JSON must be 65,536 bytes or smaller.',
    constraint = 'journal_entries_album_size';
end;
$$;

revoke all on function private.enforce_journal_album_size()
from public, anon, authenticated;

create trigger journal_entries_enforce_album_size
  before insert or update of album on public.journal_entries
  for each row execute function private.enforce_journal_album_size();

-- ---------------------------------------------------------------------------
-- Journal entry count: maximum 5,000 rows per user
-- ---------------------------------------------------------------------------

create or replace function private.enforce_journal_entry_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  entry_count integer;
begin
  -- Let the table's RLS policy reject forged user_id values without exposing
  -- another user's row count through different quota error messages.
  if new.user_id is distinct from auth.uid() then
    return new;
  end if;

  -- Serialize quota checks for this user so concurrent inserts cannot all
  -- observe the same count and race past the cap.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.user_id::text, 0)
  );

  -- INSERT ... ON CONFLICT DO UPDATE fires BEFORE INSERT triggers even when it
  -- will update an existing slot. Existing slots do not consume a new quota.
  if exists (
    select 1
    from public.journal_entries
    where user_id = new.user_id
      and theme = new.theme
      and date = new.date
  ) then
    return new;
  end if;

  select count(*)
  into entry_count
  from public.journal_entries
  where user_id = new.user_id;

  if entry_count >= 5000 then
    raise exception using
      errcode = 'P0001',
      message = 'journal entry limit exceeded',
      detail = 'Each user may store up to 5,000 journal entries.';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_journal_entry_limit()
from public, anon, authenticated;

create trigger journal_entries_enforce_user_limit
  before insert on public.journal_entries
  for each row execute function private.enforce_journal_entry_limit();

-- ---------------------------------------------------------------------------
-- Shared-card count and rate: maximum 200 total, 10 per rolling hour
-- ---------------------------------------------------------------------------

-- Rate events live separately from shared_cards. Otherwise a caller could
-- delete recently-created cards, or forge shared_cards.created_at through the
-- Data API, and immediately reset the rolling-hour count.
create table private.shared_card_creation_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Defense in depth: private is not an exposed Data API schema and its grants
-- are revoked below, but RLS also blocks access if the schema is accidentally
-- exposed later. Deliberately create no anon/authenticated policies. The
-- owner-run SECURITY DEFINER trigger function can still maintain this table.
alter table private.shared_card_creation_events enable row level security;

revoke all on table private.shared_card_creation_events
from public, anon, authenticated;

create index shared_card_creation_events_user_created_at_idx
  on private.shared_card_creation_events (user_id, created_at desc);

create or replace function private.enforce_shared_card_limits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  total_count integer;
  recent_count integer;
begin
  -- RLS remains responsible for rejecting attempts to insert for another user.
  if new.user_id is distinct from auth.uid() then
    return new;
  end if;

  -- Server-own the timestamp used by retention and display logic. A direct
  -- Data API caller must not be able to backdate newly-created cards.
  new.created_at := pg_catalog.now();

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.user_id::text, 0)
  );

  select count(*)
  into total_count
  from public.shared_cards
  where user_id = new.user_id;

  if total_count >= 200 then
    raise exception using
      errcode = 'P0001',
      message = 'shared card limit exceeded',
      detail = 'Each user may keep up to 200 shared cards.';
  end if;

  -- Keep only the rolling window needed for rate enforcement. Stale users
  -- retain at most their last small event batch until they create again; the
  -- auth.users cascade removes all events when an account is deleted.
  delete from private.shared_card_creation_events
  where user_id = new.user_id
    and created_at < pg_catalog.now() - interval '1 hour';

  select count(*)
  into recent_count
  from private.shared_card_creation_events
  where user_id = new.user_id
    and created_at >= pg_catalog.now() - interval '1 hour';

  if recent_count >= 10 then
    raise exception using
      errcode = 'P0001',
      message = 'shared card rate limit exceeded',
      detail = 'Each user may create up to 10 shared cards per hour.';
  end if;

  insert into private.shared_card_creation_events (user_id, created_at)
  values (new.user_id, pg_catalog.now());

  return new;
end;
$$;

revoke all on function private.enforce_shared_card_limits()
from public, anon, authenticated;

create trigger shared_cards_enforce_user_limits
  before insert on public.shared_cards
  for each row execute function private.enforce_shared_card_limits();
