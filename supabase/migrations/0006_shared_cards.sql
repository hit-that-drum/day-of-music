-- 0006_shared_cards.sql — public share links for the share cards.
--
-- "Copy link" freezes exactly what the poster shows into a jsonb snapshot and
-- files it under an unguessable token. The public page reads it back through
-- get_shared_card(token) below — there is NO public select policy on the
-- table itself, so links can't be enumerated: you either know a token or you
-- see nothing. Deleting a row kills its link immediately.

create table if not exists public.shared_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Client-generated 128-bit random token (base64url, 22 chars).
  token text not null unique check (char_length(token) between 16 and 64),
  kind text not null check (kind in ('week', 'month', 'stats')),
  -- Snapshot of the poster contents (never includes notes). The size cap is
  -- an abuse guard — real payloads are a few KB.
  payload jsonb not null check (pg_column_size(payload) <= 65536),
  created_at timestamptz not null default now()
);

alter table public.shared_cards enable row level security;

-- Owners manage their own share rows; readers go through the RPC only.
create policy "Users can insert own shared cards"
  on public.shared_cards for insert
  with check (auth.uid() = user_id);

create policy "Users can read own shared cards"
  on public.shared_cards for select
  using (auth.uid() = user_id);

create policy "Users can delete own shared cards"
  on public.shared_cards for delete
  using (auth.uid() = user_id);

-- Token-gated public read. SECURITY DEFINER bypasses RLS for exactly one row,
-- looked up by the token the caller must already possess.
create or replace function public.get_shared_card(share_token text)
returns table (kind text, payload jsonb, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select kind, payload, created_at
  from public.shared_cards
  where token = share_token;
$$;

revoke all on function public.get_shared_card(text) from public;
grant execute on function public.get_shared_card(text) to anon, authenticated;

create index if not exists shared_cards_user_id_idx on public.shared_cards (user_id);
