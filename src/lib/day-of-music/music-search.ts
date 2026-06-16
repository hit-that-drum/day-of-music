// music-search.ts — client-side helpers for /api/music/search (iTunes proxy).
// Converts a search result into a full Album so it can be logged in the
// journal alongside the static catalog.

import type { Album, CoverSpec, CoverStyle } from "@/lib/day-of-music/data";

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
// *Lookup* API (entity=song) through this proxy.
export type AlbumDetail = {
  id: string;
  title: string;
  artist: string;
  genre: string;
  year: number;
  releaseDate: string;
  artworkUrl: string;
  trackCount: number;
  /** Track names in disc/track order. */
  tracks: string[];
};

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

// ── Deterministic typographic cover for albums without a hand-made CoverSpec.
// (Cover renders real artwork when artworkUrl is set; this is the fallback.)

const STYLES: CoverStyle[] = ["stack", "diag", "center", "split", "edge", "ring", "block", "ticker"];

const PALETTES: Array<Omit<CoverSpec, "style">> = [
  { bg: "#b9a3d9", fg: "#1a1430", accent: "#f6e6ff" },
  { bg: "#1d1a18", fg: "#f4d35e", accent: "#c75146" },
  { bg: "#e8e3d8", fg: "#23211c", accent: "#b4552d" },
  { bg: "#10243a", fg: "#dce9f5", accent: "#5fa8d3" },
  { bg: "#f3d9c9", fg: "#3a2418", accent: "#a8623c" },
  { bg: "#222a22", fg: "#d9e8d4", accent: "#8aa86e" },
  { bg: "#f5efe0", fg: "#1f1d33", accent: "#d94f4f" },
  { bg: "#2d2433", fg: "#ecdff5", accent: "#c98bd9" },
];

function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function coverFromSeed(seed: string): CoverSpec {
  const h = hashSeed(seed);
  return {
    style: STYLES[h % STYLES.length],
    ...PALETTES[(h >> 3) % PALETTES.length],
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
    mood: [],
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
    mood: [],
    note: "",
    rating: 0,
    tracks: d.tracks ?? [],
  };
}
