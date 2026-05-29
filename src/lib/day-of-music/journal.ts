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

/** Overlay journal patches onto the static catalog, keyed by album id. */
export function mergeAlbums(patches: Record<string, JournalPatch>): Album[] {
  return ALBUMS.map((album) => {
    const patch = patches[album.id];
    return patch ? { ...album, ...patch } : album;
  });
}

/** Index merged albums by their (possibly overridden) date. */
export function indexByDate(albums: Album[]): Record<string, Album> {
  const out: Record<string, Album> = {};
  for (const album of albums) out[album.date] = album;
  return out;
}
