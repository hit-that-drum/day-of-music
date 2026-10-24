// album-stats.ts — aggregate a set of logged albums into recap stats.
// Shared by the My Logs page and the stats share cards, so both always
// summarise a catalog the same way.

import { normalizeGenre, type Album } from "@/lib/day-of-music/data";

export type AlbumStats<T extends Album> = {
  total: number;
  avgRatingNum: number;
  avgRating: string;
  genreCount: number;
  topTenGenres: [string, number][];
  fives: T[];
};

export function getAlbumStats<T extends Album>(albums: T[]): AlbumStats<T> {
  const total = albums.length;
  const avgRatingNum = total
    ? albums.reduce((s, a) => s + a.rating, 0) / total
    : 0;

  const byGenre: Record<string, number> = {};
  albums.forEach((a) => {
    const genre = normalizeGenre(a.genre);
    if (genre) byGenre[genre] = (byGenre[genre] ?? 0) + 1;
  });

  return {
    total,
    avgRatingNum,
    avgRating: total ? avgRatingNum.toFixed(2) : "—",
    genreCount: Object.keys(byGenre).length,
    topTenGenres: Object.entries(byGenre)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10),
    fives: albums.filter((a) => a.rating === 5),
  };
}

/** The numbers under a week or month card (and in the month header): albums
 *  logged, distinct genres, and the average rating to one decimal — "—" when
 *  nothing is logged. Field names match the share payload's `stats`, so a card
 *  passes the result straight through. (The My Logs recap above keeps two
 *  decimals; the period cards have always shown one.) */
export function periodSummary(albums: Pick<Album, "genre" | "rating">[]): {
  count: number;
  genres: number;
  avg: string;
} {
  const count = albums.length;
  return {
    count,
    genres: new Set(albums.map((a) => normalizeGenre(a.genre)).filter(Boolean)).size,
    avg: count ? (albums.reduce((s, a) => s + a.rating, 0) / count).toFixed(1) : "—",
  };
}
