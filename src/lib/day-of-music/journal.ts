// journal.ts — shared journal types + pure overlay helpers.
// The journal layer is what the user owns: which day an album was logged, its
// rating, and note. The albums themselves live in a separate metadata pool.

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

// The board is built in use-journal.tsx from the active theme's entries plus
// that metadata pool.
