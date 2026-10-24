// music-search.ts — client-side helpers for /api/music/search (iTunes proxy).
// Converts a search result into a full Album so it can be logged in the
// journal.

import type { Album } from "@/lib/day-of-music/data";
import { coverFromSeed } from "@/lib/day-of-music/cover-seed";
import type { AlbumDetail, TrackItem } from "@/lib/day-of-music/music-types";

export type { AlbumDetail, TrackItem };

export type MusicSearchResult = {
  id: string;
  title: string;
  artist: string;
  genre: string;
  year: number;
  releaseDate: string;
  artworkUrl: string;
  trackCount: number;
};

export async function searchMusic(
  query: string,
  opts: { limit?: number; country?: string } = {},
): Promise<MusicSearchResult[]> {
  const params = new URLSearchParams({ q: query });
  if (opts.limit) params.set("limit", String(opts.limit));
  if (opts.country) params.set("country", opts.country);

  const res = await fetch(`/api/music/search?${params}`);
  if (!res.ok) throw new Error("Music search failed");
  const data = (await res.json()) as { results: MusicSearchResult[] };
  return data.results;
}

// The Search API returns album metadata only — no tracks. To get the
// tracklist (and to resolve a pasted Apple Music link) we hit the iTunes
// *Lookup* API (entity=song) through this proxy. `AlbumDetail`/`TrackItem` are
// defined in music-types.ts and re-exported above.

/** Fetch an album's full metadata + tracklist. `id` may be a bare iTunes
 *  collectionId or the app's prefixed form ("itunes-123456"). Returns null on
 *  any failure so callers can fall back gracefully. */
export async function fetchAlbumDetail(
  id: string,
  opts: { country?: string } = {},
): Promise<AlbumDetail | null> {
  const params = new URLSearchParams({ id });
  if (opts.country) params.set("country", opts.country);

  try {
    const res = await fetch(`/api/music/album?${params}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { detail?: AlbumDetail };
    return data.detail ?? null;
  } catch {
    return null;
  }
}

export type AppleMusicLink = { id: string; country: string };

/** Parse a pasted Apple Music album URL into its collection id + storefront
 *  country (e.g. https://music.apple.com/kr/album/<slug>/1860565513 → id
 *  1860565513, country KR). The storefront matters: an album may only exist in
 *  certain stores, so we must look it up in the right one. Also accepts a bare
 *  numeric id (assumed US). Returns null if the input isn't one of those. */
export function parseAppleMusicLink(input: string): AppleMusicLink | null {
  const trimmed = input.trim();
  if (/^\d{3,}$/.test(trimmed)) return { id: trimmed, country: "US" };
  if (!/music\.apple\.com/i.test(trimmed)) return null;
  // The album id is the last purely-numeric path segment (before any query).
  const path = trimmed.split(/[?#]/)[0];
  const numeric = path.split("/").filter((s) => /^\d+$/.test(s));
  if (!numeric.length) return null;
  // Storefront is the 2-letter segment right after the host.
  const countryMatch = trimmed.match(/music\.apple\.com\/([a-z]{2})(?:\/|$)/i);
  return {
    id: numeric[numeric.length - 1],
    country: countryMatch ? countryMatch[1].toUpperCase() : "US",
  };
}

/** Build a journal-ready Album from a search result. */
export function albumFromSearchResult(r: MusicSearchResult): Album {
  return {
    id: r.id,
    date: "", // assigned when the entry is logged
    title: r.title,
    titleKo: "",
    artist: r.artist,
    genre: r.genre,
    year: r.year,
    format: "Digital",
    cover: coverFromSeed(r.id),
    artworkUrl: r.artworkUrl || undefined,
    releaseDate: r.releaseDate || undefined,
    note: "",
    rating: 0,
    tracks: [],
  };
}

/** Build a journal-ready Album from a lookup detail (e.g. a pasted URL). */
export function albumFromDetail(d: AlbumDetail): Album {
  return {
    id: d.id,
    date: "",
    title: d.title,
    titleKo: "",
    artist: d.artist,
    genre: d.genre || "—",
    year: d.year,
    format: "Digital",
    cover: coverFromSeed(d.id),
    artworkUrl: d.artworkUrl || undefined,
    releaseDate: d.releaseDate || undefined,
    kind: "album",
    note: "",
    rating: 0,
    tracks: d.tracks ?? [],
  };
}

/** Build a journal-ready Album for a single TRACK picked from an album. Uses
 *  the album's artwork; `title` is the track name and `artist` the track's
 *  artist. The id uses an "itrack-" prefix so it never collides with the
 *  album's "itunes-" id and is skipped by the album-only recovery/enrich. */
export function albumFromTrack(d: AlbumDetail, track: TrackItem): Album {
  const collectionId = d.id.replace(/^itunes-/, "");
  const id = `itrack-${collectionId}-${track.trackId}`;
  return {
    id,
    date: "",
    title: track.name,
    titleKo: "",
    artist: track.artist || d.artist,
    genre: d.genre || "—",
    year: d.year,
    format: "Digital",
    cover: coverFromSeed(id),
    artworkUrl: d.artworkUrl || undefined,
    releaseDate: d.releaseDate || undefined,
    kind: "track",
    albumTitle: d.title,
    note: "",
    rating: 0,
    tracks: [],
  };
}

/** Build a journal-ready Album the listener typed in themselves. The caller
 *  owns the id (stable while the form is open), and artwork is the optional
 *  cover they picked from their device. */
export function albumFromManual(m: {
  id: string;
  title: string;
  artist: string;
  genre: string;
  artworkUrl?: string;
}): Album {
  return {
    id: m.id,
    date: "", // assigned when the entry is logged
    title: m.title.trim(),
    titleKo: "",
    artist: m.artist.trim() || "Unknown artist",
    genre: m.genre.trim(),
    year: new Date().getFullYear(),
    format: "Manual",
    cover: coverFromSeed(m.id),
    artworkUrl: m.artworkUrl,
    kind: "album",
    note: "",
    rating: 0,
    tracks: [],
  };
}
