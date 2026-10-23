import { describe, expect, it } from "vitest";

import { getAlbumStats } from "@/lib/day-of-music/album-stats";
import type { Album } from "@/lib/day-of-music/data";

function album(id: string, rating: number, genre: string): Album {
  return {
    id,
    date: "2026-10-01",
    title: id,
    titleKo: id,
    artist: "Artist",
    genre,
    year: 2026,
    format: "LP",
    cover: { style: "stack", bg: "#111111", fg: "#eeeeee", accent: "#ff5500" },
    note: "",
    rating,
    tracks: [],
  };
}

describe("getAlbumStats", () => {
  it("summarises an empty catalog without dividing by zero", () => {
    expect(getAlbumStats([])).toEqual({
      total: 0,
      avgRatingNum: 0,
      avgRating: "—",
      genreCount: 0,
      topTenGenres: [],
      fives: [],
    });
  });

  it("averages ratings to two decimals and collects the five-star albums", () => {
    const five = album("a", 5, "Rock");
    const stats = getAlbumStats([five, album("b", 4, "Rock"), album("c", 4, "Jazz")]);
    expect(stats.total).toBe(3);
    expect(stats.avgRatingNum).toBeCloseTo(13 / 3);
    expect(stats.avgRating).toBe("4.33");
    expect(stats.fives).toEqual([five]);
  });

  it("counts genres after trimming and skipping placeholder values", () => {
    const stats = getAlbumStats([
      album("a", 3, "Rock"),
      album("b", 3, " Rock "),
      album("c", 3, "Jazz"),
      album("d", 3, "-"),
      album("e", 3, "ㅡ"),
      album("f", 3, ""),
    ]);
    expect(stats.genreCount).toBe(2);
    expect(stats.topTenGenres).toEqual([
      ["Rock", 2],
      ["Jazz", 1],
    ]);
  });

  it("keeps only the ten most frequent genres", () => {
    // "Genre i" appears i + 1 times, so Genre 11 leads and Genre 0/1 drop off.
    const albums = Array.from({ length: 12 }, (_, i) =>
      Array.from({ length: i + 1 }, (_, j) => album(`g${i}-${j}`, 3, `Genre ${i}`)),
    ).flat();
    const stats = getAlbumStats(albums);
    expect(stats.genreCount).toBe(12);
    expect(stats.topTenGenres).toHaveLength(10);
    expect(stats.topTenGenres.at(0)).toEqual(["Genre 11", 12]);
    expect(stats.topTenGenres.at(-1)).toEqual(["Genre 2", 3]);
  });
});
