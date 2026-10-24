# Supabase migrations

Plain SQL files with no Supabase CLI config, so each one is run by hand in the
SQL editor (Supabase Dashboard → SQL Editor). A new project needs **every file,
once, in filename order**. Running only `0001` leaves out share links (the
`get_shared_card()` RPC), the abuse limits and Best of.

1. `0001_journal_entries.sql` — `journal_entries`, its RLS policies and the
   `set_updated_at()` trigger function.
2. `0002_album_metadata.sql` — album metadata on each row.
3. `0003_drop_mood.sql` — drops the unused `mood` column.
4. `0004_themes.sql` — a `theme` per entry.
5. `0005_slot_by_date.sql` — one album per (theme, day).
6. `0006_shared_cards.sql` — `shared_cards` and the public `get_shared_card()` RPC.
7. `0007_abuse_limits.sql` — size, count and rate limits on journal entries and
   share cards (creates the `private` schema and
   `private.shared_card_creation_events`).
8. `0007_shared_card_expiration.sql` — share links expire after 90 days.
9. `0008_purge_expired_shared_cards.sql` — nightly sweep of expired cards.
   Needs the pg_cron extension, which the file enables
   (`create extension if not exists pg_cron`), and both `0007` files: it reads
   `shared_cards.expires_at` and cleans `private.shared_card_creation_events`.
10. `0009_best_of.sql` — `best_of` table; its trigger uses `0001`'s
    `set_updated_at()`.

Notes:

- Two files share the number `0007`. Neither uses the other's objects, so
  filename order is fine. The next new migration is `0010`.
- Not every file can be re-run: `0007_abuse_limits.sql` adds constraints,
  triggers and a table without `if not exists` guards. Run each file once.
- Already-applied files are history: change the schema with a new file rather
  than editing an old one.
