-- 0004_themes.sql — multiple themed lanes per day.
--
-- Each journal entry now belongs to a `theme` (a named lane like "New finds",
-- "On repeat", "Fits the day"). A day can hold one album per theme, so the
-- uniqueness key moves from (user_id, album_id) to (user_id, theme, album_id).
-- Existing rows are assigned the default "daily" theme so nothing is lost.
--
-- Run this in the Supabase SQL editor (or `supabase db push`).

alter table public.journal_entries
  add column if not exists theme text not null default 'daily';

-- Swap the uniqueness constraint to include the theme.
alter table public.journal_entries
  drop constraint if exists journal_entries_user_album_unique;

alter table public.journal_entries
  add constraint journal_entries_user_theme_album_unique
  unique (user_id, theme, album_id);
