// journal-cache.ts — the pure half of use-journal.tsx's cache updates. The
// journal query cache holds journal entries (one per theme + date slot) and the
// album metadata pool (keyed by album id); these functions turn one cache state
// into the next, and normalizeAlbum vets the album blobs a load reads into it.
// JournalProvider keeps the I/O — Supabase, localStorage, the move chain — and
// calls these for the optimistic updates, the move / swap staging and its
// rollback, so that logic is testable on its own.

import { coverFromSeed } from "@/lib/day-of-music/cover-seed";
import type { Album } from "@/lib/day-of-music/data";
import type { AlbumMeta, JournalEntry } from "@/lib/day-of-music/journal";

export type JournalCache = { entries: JournalEntry[]; albums: Album[] };

/** An album blob as a load reads it back — a journal row's `album` jsonb or
 *  the local-mode pool in localStorage — made safe to render. Every write
 *  stores a whole Album, so this is defensive: a missing required field gets a
 *  default rather than the album being dropped (an entry without metadata
 *  vanishes from the board), and the optional fields — tracksCountry,
 *  tracksVersion and releaseDate, which Day Detail's enrichment checks, among
 *  them — pass through as stored. `id` is the album id the blob is stored
 *  under, for a blob without its own. Null for a missing blob or one with no id. */
export function normalizeAlbum(raw: unknown, id?: string): Album | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const a = raw as Partial<Album>;
  const albumId = typeof a.id === "string" && a.id ? a.id : id;
  if (!albumId) return null;
  return {
    ...a,
    id: albumId,
    date: a.date ?? "",
    title: a.title ?? "",
    titleKo: a.titleKo ?? "",
    artist: a.artist ?? "",
    genre: a.genre ?? "",
    year: a.year ?? 0,
    format: a.format ?? "",
    cover: a.cover ?? coverFromSeed(albumId),
    note: a.note ?? "",
    rating: a.rating ?? 0,
    tracks: Array.isArray(a.tracks) ? a.tracks : [],
  };
}

/** One album per day per theme: (theme, date) identifies a slot. */
export function isSlot(entry: JournalEntry, theme: string, date: string): boolean {
  return entry.theme === theme && entry.date === date;
}

/** An album as a day shows it: its metadata plus that day's journal overlay. */
export function mergeEntry(
  meta: AlbumMeta,
  entry: Pick<JournalEntry, "date" | "rating" | "note">,
): Album {
  return { ...meta, date: entry.date, rating: entry.rating, note: entry.note };
}

/** The album in the (theme, date) slot, its metadata from `pool` first and the
 *  cache's own album list second; undefined for an empty slot or metadata
 *  that isn't loaded. */
export function slotAlbum(
  cache: JournalCache,
  theme: string,
  date: string,
  pool: ReadonlyMap<string, Album>,
): Album | undefined {
  const entry = cache.entries.find((e) => isSlot(e, theme, date));
  if (!entry) return undefined;
  const meta = pool.get(entry.albumId) ?? cache.albums.find((a) => a.id === entry.albumId);
  return meta ? mergeEntry(meta, entry) : undefined;
}

/** Log or replace `album` in the (theme, album.date) slot, refreshing its
 *  metadata in the pool (theme-independent). */
export function applyUpsert(cache: JournalCache, album: Album, theme: string): JournalCache {
  const entry: JournalEntry = {
    albumId: album.id,
    date: album.date,
    rating: album.rating,
    note: album.note,
    theme,
  };
  return {
    entries: [...cache.entries.filter((e) => !isSlot(e, theme, album.date)), entry],
    albums: [...cache.albums.filter((a) => a.id !== album.id), album],
  };
}

/** Clear the (theme, date) slot. The album's metadata stays in the pool. */
export function applyRemove(cache: JournalCache, date: string, theme: string): JournalCache {
  return { ...cache, entries: cache.entries.filter((e) => !isSlot(e, theme, date)) };
}

/** Move `a` (in fromDate's slot) to toDate, and `b` (toDate's previous album,
 *  if any) the other way — one swap, both slots replaced together. */
export function applySwap(
  cache: JournalCache,
  theme: string,
  fromDate: string,
  toDate: string,
  a: Album,
  b: Album | undefined,
): JournalCache {
  const touched = (e: JournalEntry) => isSlot(e, theme, fromDate) || isSlot(e, theme, toDate);
  const entries: JournalEntry[] = [
    ...cache.entries.filter((e) => !touched(e)),
    { albumId: a.id, date: toDate, rating: a.rating, note: a.note, theme },
  ];
  if (b) {
    entries.push({ albumId: b.id, date: fromDate, rating: b.rating, note: b.note, theme });
  }
  return { ...cache, entries };
}

/** Undo a swap: put the two slots back the way `before` had them, on top of
 *  `current` — so whatever else changed since (a later move on other days)
 *  survives. */
export function restoreSlots(
  current: JournalCache,
  before: JournalCache,
  theme: string,
  fromDate: string,
  toDate: string,
): JournalCache {
  const touched = (e: JournalEntry) => isSlot(e, theme, fromDate) || isSlot(e, theme, toDate);
  return {
    ...current,
    entries: [...current.entries.filter((e) => !touched(e)), ...before.entries.filter(touched)],
  };
}
