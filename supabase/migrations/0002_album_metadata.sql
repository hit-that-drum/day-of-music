-- 0002_album_metadata.sql — sync album metadata, not just the journal overlay.
--
-- Until now journal_entries stored only the overlay (date, rating, note, mood)
-- and pointed at an album_id. The album's actual metadata (title, artist, cover
-- art, tracklist) lived only in the browser's localStorage, so a second device
-- loaded the entries but had no album to render them against — the calendar
-- came up empty. Storing the metadata blob on the row makes albums sync too.
--
-- Run this in the Supabase SQL editor (or `supabase db push`).

alter table public.journal_entries
  add column if not exists album jsonb;
