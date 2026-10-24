// journal.ts — shared journal types + pure overlay helpers.
// The journal layer is what the user owns: which day an album was logged, its
// rating, and note. The albums themselves live in a separate metadata pool.

import type { Album } from "@/lib/day-of-music/data";

export type JournalEntry = {
  albumId: string;
  date: string; // YYYY-MM-DD
  rating: number;
  note: string;
  /** Which themed lane this entry belongs to (theme id). */
  theme: string;
};

// A partial edit applied to an album's journal layer (never the theme).
export type JournalPatch = Partial<Omit<JournalEntry, "albumId" | "theme">>;

/** An album's own metadata — what the metadata pool keeps per album id —
 *  without a day's journal overlay (date, rating, note); mergeEntry in
 *  journal-cache.ts puts the two together. */
export type AlbumMeta = Omit<Album, "date" | "rating" | "note">;

/** A logged album together with the themed lane it was logged in. */
export type JournalAlbum = Album & Pick<JournalEntry, "theme">;

// Local-mode (no Supabase) journal. The key still says v1 but holds the v2
// array format; readLocalEntries in use-journal.tsx also reads the older v1
// map. Don't rename it — journals already saved under it would be orphaned.
export const JOURNAL_STORAGE_KEY = "day-of-music:journal:v1";
export const CUSTOM_ALBUMS_STORAGE_KEY = "day-of-music:custom-albums:v1";

// The board is built in use-journal.tsx from the active theme's entries plus
// that metadata pool.
