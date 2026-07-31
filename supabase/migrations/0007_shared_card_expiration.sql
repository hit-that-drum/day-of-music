-- 0007_shared_card_expiration.sql — make stored share links expire after 90 days.
--
-- Existing links are backfilled from their original creation time. Expired
-- rows remain visible to their owner for review/deletion, but the public RPC
-- stops returning their payload immediately.

alter table public.shared_cards
  add column if not exists expires_at timestamptz;

alter table public.shared_cards
  alter column expires_at set default (now() + interval '90 days');

update public.shared_cards
set expires_at = created_at + interval '90 days'
where expires_at is null;

alter table public.shared_cards
  alter column expires_at set not null;

create index if not exists shared_cards_expires_at_idx
  on public.shared_cards (expires_at);

-- Keep the RPC's existing return shape so current web clients remain
-- compatible. An expired token behaves exactly like an unknown/deleted token.
create or replace function public.get_shared_card(share_token text)
returns table (kind text, payload jsonb, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select kind, payload, created_at
  from public.shared_cards
  where token = share_token
    and expires_at > now();
$$;

revoke all on function public.get_shared_card(text) from public;
grant execute on function public.get_shared_card(text) to anon, authenticated;
