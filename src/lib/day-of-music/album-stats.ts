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
