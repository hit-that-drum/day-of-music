// journal.ts — shared journal types + pure overlay helpers.
// The journal layer is what the user owns: which day an album was logged, its
// rating, note, and mood. It overlays the static ALBUMS catalog.

import { ALBUMS, type Album } from "@/lib/day-of-music/data";

export type JournalEntry = {
  albumId: string;
  date: string; // YYYY-MM-DD
  rating: number;
  note: string;
  mood: string[];
};

// A partial edit applied to an album's journal layer.
export type JournalPatch = Partial<Omit<JournalEntry, "albumId">>;

export const JOURNAL_STORAGE_KEY = "day-of-music:journal:v1";
export const CUSTOM_ALBUMS_STORAGE_KEY = "day-of-music:custom-albums:v1";

/**
 * Build the user's board from their journal entries.
 *
 * Only albums the user has actually logged appear — an album shows up iff it
 * has a journal patch (entry). The static ALBUMS catalog is NOT pre-placed on
 * the calendar; it only serves as quick-pick suggestions in the add-flow
 * search. `customAlbums` are user-added albums (e.g. from music search).
 */
export function mergeAlbums(
  patches: Record<string, JournalPatch>,
  customAlbums: Album[] = [],
): Album[] {
  const base = [...ALBUMS, ...customAlbums];
  // Single pass: look up each album's patch once, keep only the ones logged.
  // acc is a fresh local array, so the in-place push is contained to this scope.
  return base.reduce<Album[]>((acc, album) => {
    const patch = patches[album.id];
    if (patch) acc.push({ ...album, ...patch });
    return acc;
  }, []);
}

/** Index merged albums by their (possibly overridden) date. */
export function indexByDate(albums: Album[]): Record<string, Album> {
  const out: Record<string, Album> = {};
  for (const album of albums) out[album.date] = album;
  return out;
}
