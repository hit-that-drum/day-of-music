-- 0009_best_of.sql — move Best-of results out of user_metadata into a table.
--
-- Results were stored on the account as user_metadata.bestOf. Supabase embeds
-- user_metadata in every access token, and the token rides along as the
-- Authorization header on every PostgREST request — so an ever-growing map of
-- tournament winners became an ever-growing request header. One account reached
-- 11.7 KiB of bestOf (a ~30 KiB session blob), which is past what WebKit will
-- send: Safari dropped the connection on every query ("The network connection
-- was lost") while Chrome, with a much higher header ceiling, was unaffected.
--
-- Nothing about the data wanted to live in a token. It's one small row per
-- (period, theme, period key), which is exactly what a table is for. The client
-- copies any existing user_metadata.bestOf in here on first load and then
-- clears that key, so accounts heal themselves as they are opened.

create table if not exists public.best_of (
  user_id uuid not null references auth.users (id) on delete cascade,
  -- bestOfKey(): "<period>:<theme>:<periodKey>", e.g. "week:daily:2026-08-24".
  -- Kept as the single opaque key the client already builds, so the bracket
  -- code needs no schema knowledge to look a result up.
  key text not null,
  winner_date text not null, -- YYYY-MM-DD, matching journal_entries.date
  method text not null check (method in ('sequential', 'random')),
  decided_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Latest decision wins, so a re-run of the same tournament overwrites.
  primary key (user_id, key)
);

alter table public.best_of enable row level security;

-- Same shape as journal_entries (0001): RLS is the whole authorization layer,
-- so every statement is scoped to the calling user.
create policy "Users can read own best_of"
  on public.best_of for select
  using (auth.uid() = user_id);

create policy "Users can insert own best_of"
  on public.best_of for insert
  with check (auth.uid() = user_id);

create policy "Users can update own best_of"
  on public.best_of for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own best_of"
  on public.best_of for delete
  using (auth.uid() = user_id);

-- set_updated_at() is created by 0001_journal_entries.sql.
create trigger best_of_updated_at
  before update on public.best_of
  for each row execute function public.set_updated_at();
