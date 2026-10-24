// cover-seed.ts — the deterministic typographic cover for albums that arrive
// without a hand-made CoverSpec (search results, pasted links, manual entries).
// Cover renders the real artwork when artworkUrl is set; this is the fallback,
// and the same seed always gives the same tile.

import { COVER_STYLES, type CoverSpec } from "@/lib/day-of-music/data";

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
    style: COVER_STYLES[h % COVER_STYLES.length],
    ...PALETTES[(h >> 3) % PALETTES.length],
  };
}
