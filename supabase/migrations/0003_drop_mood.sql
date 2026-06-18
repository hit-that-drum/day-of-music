-- 0003_drop_mood.sql — remove the unused `mood` column.
--
-- The mood feature was removed from the app (the journal overlay is now just
-- date / rating / note, plus the album metadata blob). The app no longer reads
-- or writes this column, so drop it. Existing mood data is discarded.
--
-- Run this in the Supabase SQL editor (or `supabase db push`).

alter table public.journal_entries
  drop column if exists mood;
