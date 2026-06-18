// journal.ts — shared journal types + pure overlay helpers.
// The journal layer is what the user owns: which day an album was logged, its
// rating, and note. It overlays the static ALBUMS catalog.

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

export const JOURNAL_STORAGE_KEY = "day-of-music:journal:v1";
export const CUSTOM_ALBUMS_STORAGE_KEY = "day-of-music:custom-albums:v1";

// NOTE: the board is now built inside use-journal.tsx directly from the active
// theme's entries + the metadata pool (the static ALBUMS catalog is only a
// quick-pick source in the add-flow, never pre-placed on the calendar). The old
// mergeAlbums/indexByDate overlay helpers that lived here had no remaining
// callers and were removed.
