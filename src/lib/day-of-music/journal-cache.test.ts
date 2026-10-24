import { describe, expect, it } from "vitest";

import { coverFromSeed } from "@/lib/day-of-music/cover-seed";
import type { Album } from "@/lib/day-of-music/data";
import type { JournalEntry } from "@/lib/day-of-music/journal";
import {
  applyRemove,
  applySwap,
  applyUpsert,
  mergeEntry,
  normalizeAlbum,
  restoreSlots,
  slotAlbum,
  type JournalCache,
} from "@/lib/day-of-music/journal-cache";

function album(id: string, overrides: Partial<Album> = {}): Album {
  return {
    id,
    date: "",
    title: id,
    titleKo: "",
    artist: "Artist",
    genre: "Rock",
    year: 2026,
    format: "Digital",
    cover: { style: "stack", bg: "#000", fg: "#fff", accent: "#f00" },
    note: "",
    rating: 0,
    tracks: [],
    ...overrides,
  };
}

const entry = (albumId: string, date: string, theme = "daily", rating = 3): JournalEntry => ({
  albumId,
  date,
  rating,
  note: `${albumId}@${date}`,
  theme,
});

const A = album("A");
const B = album("B");
const C = album("C");

// A on the 19th and B on the 20th in "daily"; C on the 19th in another lane.
const base: JournalCache = {
  entries: [entry("A", "2026-10-19"), entry("B", "2026-10-20", "daily", 5), entry("C", "2026-10-19", "drive")],
  albums: [A, B, C],
};

describe("normalizeAlbum", () => {
  it("passes a whole album through as stored, optional fields included", () => {
    const stored = album("itunes-1", { tracksCountry: "KR", tracksVersion: 2, releaseDate: "2024-10-14" });
    expect(normalizeAlbum(stored)).toEqual(stored);
  });

  it("repairs a blob with missing fields instead of dropping it", () => {
    const repaired = normalizeAlbum({ id: "itunes-2", title: "Partial" });
    expect(repaired).toMatchObject({ id: "itunes-2", title: "Partial", artist: "", rating: 0, note: "", tracks: [] });
    expect(repaired?.cover).toEqual(coverFromSeed("itunes-2"));
  });

  it("takes the id the blob is stored under when it has none of its own", () => {
    expect(normalizeAlbum({ title: "No id" }, "itunes-3")?.id).toBe("itunes-3");
  });

  it("is null for a missing blob, a non-object, or no id at all", () => {
    expect(normalizeAlbum(null, "itunes-4")).toBeNull();
    expect(normalizeAlbum("album", "itunes-4")).toBeNull();
    expect(normalizeAlbum([], "itunes-4")).toBeNull();
    expect(normalizeAlbum({ title: "No id" })).toBeNull();
  });
});

describe("mergeEntry", () => {
  it("overlays the day's date, rating and note on the album's metadata", () => {
    expect(mergeEntry(A, entry("A", "2026-10-19", "daily", 4))).toEqual({
      ...A,
      date: "2026-10-19",
      rating: 4,
      note: "A@2026-10-19",
    });
  });
});

describe("slotAlbum", () => {
  it("prefers the pool's metadata over the cache's own copy", () => {
    const fresher = { ...A, title: "A (enriched)" };
    expect(slotAlbum(base, "daily", "2026-10-19", new Map([["A", fresher]]))?.title).toBe(
      "A (enriched)",
    );
    expect(slotAlbum(base, "daily", "2026-10-19", new Map())?.title).toBe("A");
  });

  it("is undefined for an empty slot or a lane that has nothing there", () => {
    expect(slotAlbum(base, "daily", "2026-10-21", new Map())).toBeUndefined();
    expect(slotAlbum(base, "drive", "2026-10-20", new Map())).toBeUndefined();
  });
});

describe("applyUpsert", () => {
  it("replaces only the same lane's slot and refreshes the album in the pool", () => {
    const D = album("D", { date: "2026-10-19", rating: 2, note: "new" });
    const next = applyUpsert(base, D, "daily");
    expect(next.entries).toContainEqual({ albumId: "D", date: "2026-10-19", rating: 2, note: "new", theme: "daily" });
    expect(next.entries.find((e) => e.albumId === "A")).toBeUndefined();
    // The other lane's entry on the same day is untouched.
    expect(next.entries).toContainEqual(entry("C", "2026-10-19", "drive"));
    expect(next.albums.map((a) => a.id)).toEqual(["A", "B", "C", "D"]);
  });

  it("keeps one copy of the metadata when the same album is logged again", () => {
    const again = { ...B, date: "2026-10-22", title: "B (renamed)" };
    const next = applyUpsert(base, again, "daily");
    expect(next.albums.filter((a) => a.id === "B")).toEqual([again]);
    expect(next.entries.filter((e) => e.albumId === "B")).toHaveLength(2);
  });
});

describe("applyRemove", () => {
  it("clears one slot and leaves the metadata pool alone", () => {
    const next = applyRemove(base, "2026-10-19", "daily");
    expect(next.entries.map((e) => `${e.albumId}@${e.date}/${e.theme}`)).toEqual([
      "B@2026-10-20/daily",
      "C@2026-10-19/drive",
    ]);
    expect(next.albums).toBe(base.albums);
  });
});

describe("applySwap and restoreSlots", () => {
  const a = mergeEntry(A, entry("A", "2026-10-19"));
  const b = mergeEntry(B, entry("B", "2026-10-20", "daily", 5));

  it("moves an album onto an empty day", () => {
    const next = applySwap(base, "daily", "2026-10-19", "2026-10-21", a, undefined);
    expect(slotAlbum(next, "daily", "2026-10-21", new Map())?.id).toBe("A");
    expect(slotAlbum(next, "daily", "2026-10-19", new Map())).toBeUndefined();
  });

  it("swaps two albums, each keeping its own rating and note", () => {
    const next = applySwap(base, "daily", "2026-10-19", "2026-10-20", a, b);
    expect(next.entries).toContainEqual({ ...entry("A", "2026-10-20"), note: "A@2026-10-19" });
    expect(next.entries).toContainEqual({ ...entry("B", "2026-10-19", "daily", 5), note: "B@2026-10-20" });
    expect(next.entries).toContainEqual(entry("C", "2026-10-19", "drive"));
  });

  it("rolls back only the two slots a move touched", () => {
    const staged = applySwap(base, "daily", "2026-10-19", "2026-10-20", a, b);
    // A later move, staged before this one's writes failed, put D on the 23rd.
    const later = applyUpsert(staged, album("D", { date: "2026-10-23" }), "daily");
    const restored = restoreSlots(later, base, "daily", "2026-10-19", "2026-10-20");
    expect(slotAlbum(restored, "daily", "2026-10-19", new Map())?.id).toBe("A");
    expect(slotAlbum(restored, "daily", "2026-10-20", new Map())?.id).toBe("B");
    expect(slotAlbum(restored, "daily", "2026-10-23", new Map())?.id).toBe("D");
  });
});
