-- 0008_purge_expired_shared_cards.sql — reclaim the rows expiry only hid.
--
-- 0007_shared_card_expiration.sql stopped get_shared_card() from returning
-- expired snapshots, but deliberately left the rows in place so an owner could
-- still see (and delete) what they had shared. Nothing ever removed them
-- afterwards, so the table only grows: every card a user has ever minted stays
-- forever, at up to 64 KiB of payload each (200 per user).
--
-- This is the missing back half — a nightly sweep that drops rows a month past
-- their expiry. The grace window is what keeps the "still visible to its owner"
-- promise meaningful; once it passes, the snapshot has been unreachable to the
-- public for 30 days and is safe to reclaim.
--
-- Requires pg_cron (available on Supabase). The function is useful on its own:
-- if you would rather drive the sweep from outside the database, skip the
-- schedule at the bottom and call
--   select private.purge_expired_shared_cards();
-- from a scheduled job instead.

-- Trigger/maintenance functions live outside the exposed API schema
-- (0007_abuse_limits.sql created this; repeated here so the file stands alone).
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The sweep
-- ---------------------------------------------------------------------------

create or replace function private.purge_expired_shared_cards()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- How long an expired card sticks around for its owner to review before the
  -- sweep reclaims it. This is the only knob worth changing.
  grace constant interval := interval '30 days';
  purged integer;
begin
  delete from public.shared_cards
  where expires_at < pg_catalog.now() - grace;
  get diagnostics purged = row_count;

  -- Rate-limit bookkeeping from 0007_abuse_limits.sql. Its insert trigger only
  -- prunes the *inserting* user's window, so someone who shares once and never
  -- returns leaves their last batch behind for good. The window is one hour, so
  -- anything older is dead weight no matter whose it is.
  delete from private.shared_card_creation_events
  where created_at < pg_catalog.now() - interval '1 hour';

  return purged;
end;
$$;

-- Maintenance only — never reachable from the Data API.
revoke all on function private.purge_expired_shared_cards()
from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The schedule
-- ---------------------------------------------------------------------------

create extension if not exists pg_cron;

-- Re-running this migration must not stack a second copy of the job. pg_cron
-- 1.4+ upserts by name, but unscheduling first keeps that from being load
-- bearing. (`select … where` with no FROM is a one-row conditional.)
select cron.unschedule('purge-expired-shared-cards')
where exists (
  select 1 from cron.job where jobname = 'purge-expired-shared-cards'
);

-- 04:17 UTC daily — off-peak, and off the hour so it doesn't pile onto whatever
-- else fires at :00.
select cron.schedule(
  'purge-expired-shared-cards',
  '17 4 * * *',
  $$select private.purge_expired_shared_cards();$$
);
