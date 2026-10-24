import { describe, expect, it } from "vitest";

import { coverFromSeed } from "@/lib/day-of-music/cover-seed";
import { COVER_STYLES } from "@/lib/day-of-music/data";
import { albumFromManual } from "@/lib/day-of-music/music-search";

describe("coverFromSeed", () => {
  it("gives the same tile for the same seed, in one of the cover styles", () => {
    for (const seed of ["itunes-1440857781", "itrack-1-2", "manual-abc", ""]) {
      const cover = coverFromSeed(seed);
      expect(coverFromSeed(seed)).toEqual(cover);
      expect(COVER_STYLES).toContain(cover.style);
    }
  });
});

describe("albumFromManual", () => {
  // These fields are saved as-is into the journal (Supabase / localStorage),
  // so a changed default silently changes every new manual entry.
  it("builds the stored album from the form fields", () => {
    expect(
      albumFromManual({
        id: "manual-1",
        title: "  Blue  ",
        artist: " Joni ",
        genre: " Folk ",
        artworkUrl: "data:image/jpeg;base64,AAAA",
      }),
    ).toEqual({
      id: "manual-1",
      date: "",
      title: "Blue",
      titleKo: "",
      artist: "Joni",
      genre: "Folk",
      year: new Date().getFullYear(),
      format: "Manual",
      cover: coverFromSeed("manual-1"),
      artworkUrl: "data:image/jpeg;base64,AAAA",
      kind: "album",
      note: "",
      rating: 0,
      tracks: [],
    });
  });

  it("names a blank artist and leaves artwork out when none was picked", () => {
    const album = albumFromManual({ id: "m", title: "T", artist: "  ", genre: "" });
    expect(album.artist).toBe("Unknown artist");
    expect(album.artworkUrl).toBeUndefined();
  });
});
