-- 0005_slot_by_date.sql — one album per (theme, day), keyed by date.
--
-- Previously the uniqueness key was (user_id, theme, album_id), so logging the
-- same album on a second day just moved the existing row instead of adding a
-- new one. The journal slot is really (user_id, theme, date) — one album per
-- day per theme — and the same album may appear on multiple days. This swaps
-- the constraint accordingly.
--
-- Run this in the Supabase SQL editor (or `supabase db push`).

-- Collapse any pre-existing duplicates on the same (user, theme, date), keeping
-- the most recently updated row, so the new unique constraint can be added.
delete from public.journal_entries a
using public.journal_entries b
where a.user_id = b.user_id
  and a.theme = b.theme
  and a.date = b.date
  and (a.updated_at, a.ctid) < (b.updated_at, b.ctid);

alter table public.journal_entries
  drop constraint if exists journal_entries_user_theme_album_unique;

alter table public.journal_entries
  add constraint journal_entries_user_theme_date_unique
  unique (user_id, theme, date);
