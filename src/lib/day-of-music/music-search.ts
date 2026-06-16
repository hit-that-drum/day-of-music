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
    mood: [],
    note: "",
    rating: 0,
    tracks: [],
  };
}
