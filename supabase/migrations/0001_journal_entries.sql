-- 0001_journal_entries.sql — journal table + Row Level Security.
--
-- Run this in the Supabase SQL editor (or `supabase db push` with the CLI).
-- The web and mobile apps query this table directly with supabase-js;
-- these RLS policies are the entire authorization layer, so each user can
-- only ever see and modify their own rows.

create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  album_id text not null,
  date text not null, -- YYYY-MM-DD
  rating integer not null default 0 check (rating between 0 and 5),
  note text not null default '',
  mood jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint journal_entries_user_album_unique unique (user_id, album_id)
);

alter table public.journal_entries enable row level security;

create policy "Users can read own entries"
  on public.journal_entries for select
  using (auth.uid() = user_id);

create policy "Users can insert own entries"
  on public.journal_entries for insert
  with check (auth.uid() = user_id);

create policy "Users can update own entries"
  on public.journal_entries for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own entries"
  on public.journal_entries for delete
  using (auth.uid() = user_id);

-- Keep updated_at fresh on every update.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger journal_entries_updated_at
  before update on public.journal_entries
  for each row execute function public.set_updated_at();
