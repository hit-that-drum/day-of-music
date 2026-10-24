import { afterEach, describe, expect, it, vi } from "vitest";

import { COVER_STYLES, type Album } from "@/lib/day-of-music/data";
import { AESTHETIC_KEYS, TYPE_KEYS } from "@/lib/day-of-music/appearance";
import {
  buildMonthSharePayload,
  buildWeekSharePayload,
  createGuestWeekLink,
  sanitizeAlbum,
} from "@/lib/day-of-music/share-links";
import {
  decodeGuestShareParam,
  isShareableArtwork,
  monthSharePayloadSchema,
  sharePayloadSchema,
  weekSharePayloadSchema,
  type SharedAlbum,
  type WeekSharePayload,
} from "@/lib/day-of-music/share-payload";

const HTTPS_ART = "https://is1-ssl.mzstatic.com/image/thumb/x/600x600bb.jpg";

function album(overrides: Partial<Album> = {}): Album {
  return {
    id: "itunes-1",
    date: "2026-10-20",
    title: "Title",
    titleKo: "제목",
    artist: "Artist",
    genre: "Rock",
    year: 2026,
    format: "LP",
    cover: { style: "stack", bg: "#111111", fg: "#eeeeee", accent: "#ff5500" },
    note: "private note",
    rating: 4,
    tracks: ["Track 1", "Track 2"],
    ...overrides,
  };
}

/** A week card as share-card.tsx builds it: Mon–Sun, one day logged. */
function weekPayload(tuesday: SharedAlbum): WeekSharePayload {
  const day = (date: string, dayNum: number, dow: string) => ({
    date,
    dayNum,
    dow,
    outOfMonth: false,
  });
  return {
    v: 1,
    kind: "week",
    title: "October · Week 4",
    username: "listener",
    themeLabel: "🎧 Daily",
    theme: { aesthetic: "editorial", typography: "modern" },
    cells: [
      day("2026-10-19", 19, "MON"),
      { ...day("2026-10-20", 20, "TUE"), album: tuesday },
      day("2026-10-21", 21, "WED"),
      day("2026-10-22", 22, "THU"),
      day("2026-10-23", 23, "FRI"),
      day("2026-10-24", 24, "SAT"),
      day("2026-10-25", 25, "SUN"),
    ],
    stats: { count: 1, genres: 1, avg: "4.0" },
  };
}

const base64url = (s: string) => Buffer.from(s).toString("base64url");

describe("sanitizeAlbum", () => {
  it("keeps only the allowlisted fields — notes and tracklists stay on the device", () => {
    const shared = sanitizeAlbum({
      ...album({
        artworkUrl: HTTPS_ART,
        kind: "track",
        albumTitle: "Parent album",
        releaseDate: "2026-01-01T00:00:00Z",
        tracksCountry: "KR",
        tracksVersion: 2,
      }),
      theme: "daily",
    });
    expect(Object.keys(shared).sort()).toEqual([
      "albumTitle",
      "artist",
      "artworkUrl",
      "cover",
      "date",
      "format",
      "genre",
      "id",
      "kind",
      "rating",
      "theme",
      "title",
      "titleKo",
      "year",
    ]);
  });

  it("leaves absent optional fields out instead of writing undefined", () => {
    const shared = sanitizeAlbum(album());
    for (const key of ["artworkUrl", "kind", "albumTitle", "theme"]) {
      expect(shared).not.toHaveProperty(key);
    }
  });
});

describe("isShareableArtwork", () => {
  it("accepts remote https covers and raster data URLs", () => {
    expect(isShareableArtwork(HTTPS_ART)).toBe(true);
    expect(isShareableArtwork("data:image/jpeg;base64,/9j/4AAQ")).toBe(true);
  });

  it("rejects what can't render — or shouldn't — in someone else's browser", () => {
    expect(isShareableArtwork(undefined)).toBe(false);
    expect(isShareableArtwork("http://example.com/cover.jpg")).toBe(false);
    expect(isShareableArtwork("blob:https://dayofmusic.app/1234")).toBe(false);
    // SVG can carry markup, so it never travels.
    expect(isShareableArtwork("data:image/svg+xml;base64,PHN2Zz4=")).toBe(false);
  });
});

describe("sharePayloadSchema", () => {
  const valid = weekPayload(sanitizeAlbum(album({ artworkUrl: HTTPS_ART })));

  it("accepts a payload the app builds", () => {
    expect(sharePayloadSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts every cover style and theme the app can produce", () => {
    for (const style of COVER_STYLES) {
      const cover = { ...album().cover, style };
      expect(sharePayloadSchema.safeParse(weekPayload(sanitizeAlbum(album({ cover })))).success).toBe(true);
    }
    for (const aesthetic of AESTHETIC_KEYS) {
      for (const typography of TYPE_KEYS) {
        const themed = { ...valid, theme: { aesthetic, typography } };
        expect(sharePayloadSchema.safeParse(themed).success).toBe(true);
      }
    }
  });

  it("rejects tampered payloads", () => {
    const withArtwork = (artworkUrl: string) =>
      weekPayload({ ...sanitizeAlbum(album()), artworkUrl });
    for (const tampered of [
      { ...valid, cells: valid.cells.slice(0, 6) },
      { ...valid, kind: "year" },
      withArtwork("javascript:alert(1)"),
      withArtwork("data:image/svg+xml;base64,PHN2Zz4="),
    ]) {
      expect(sharePayloadSchema.safeParse(tampered).success).toBe(false);
    }
  });
});

describe("guest week links", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("round-trips the payload through a compressed /s?d= link", async () => {
    vi.stubGlobal("window", { location: { origin: "https://dom.test" } });
    const payload = weekPayload(sanitizeAlbum(album({ artworkUrl: HTTPS_ART })));
    const url = new URL(await createGuestWeekLink(payload));
    expect(`${url.origin}${url.pathname}`).toBe("https://dom.test/s");
    const d = url.searchParams.get("d") ?? "";
    expect(d.startsWith("1")).toBe(true);
    expect(weekSharePayloadSchema.parse(await decodeGuestShareParam(d))).toEqual(payload);
  });

  it("falls back to an uncompressed link without CompressionStream", async () => {
    vi.stubGlobal("window", { location: { origin: "https://dom.test" } });
    vi.stubGlobal("CompressionStream", undefined);
    const payload = weekPayload(sanitizeAlbum(album()));
    const d = new URL(await createGuestWeekLink(payload)).searchParams.get("d") ?? "";
    expect(d.startsWith("0")).toBe(true);
    expect(await decodeGuestShareParam(d)).toEqual(payload);
  });

  it("drops artwork only this device can open", async () => {
    vi.stubGlobal("window", { location: { origin: "https://dom.test" } });
    const payload = weekPayload(sanitizeAlbum(album({ artworkUrl: "blob:https://dom.test/1" })));
    const d = new URL(await createGuestWeekLink(payload)).searchParams.get("d") ?? "";
    const shared = weekSharePayloadSchema.parse(await decodeGuestShareParam(d));
    expect(shared.cells[1]?.album).toBeDefined();
    expect(shared.cells[1]?.album).not.toHaveProperty("artworkUrl");
  });

  it("still opens links already shared in the wild", async () => {
    const decoded = weekSharePayloadSchema.parse(await decodeGuestShareParam(GOLDEN_GUEST_PARAM));
    expect(decoded.title).toBe("October · Week 4");
    expect(decoded.cells[1]?.album?.title).toBe("Title");
  });

  it("decodes a param of up to 16,384 characters and nothing longer", async () => {
    // "0" + base64url of N JSON bytes is 1 + ceil(4N / 3) characters long:
    // 12,287 bytes → 16,384 characters, 12,288 bytes → 16,385.
    const plainParam = (jsonBytes: number) =>
      `0${base64url(JSON.stringify({ pad: "x".repeat(jsonBytes - '{"pad":""}'.length) }))}`;
    expect(plainParam(12_287)).toHaveLength(16_384);
    expect(await decodeGuestShareParam(plainParam(12_287))).not.toBeNull();
    expect(plainParam(12_288)).toHaveLength(16_385);
    expect(await decodeGuestShareParam(plainParam(12_288))).toBeNull();
  });

  it.each([
    ["an empty param", ""],
    ["a bare prefix", "1"],
    ["something that isn't base64", "1!!!!"],
    ["bytes that aren't deflate", `1${base64url("not deflate")}`],
    ["text that isn't JSON", `0${base64url("{oops")}`],
  ])("returns null for %s", async (_, d) => {
    expect(await decodeGuestShareParam(d)).toBeNull();
  });
});

/** A guest link minted by the encoder at the time these tests were written (the
 *  weekPayload above with HTTPS_ART). Links like it are already out in chats
 *  and bookmarks, so the decoder and schema must keep accepting it — never
 *  regenerate this to make a failing test pass. */
const GOLDEN_GUEST_PARAM = [
  "1jZJNbtswEIWvYrxsaesnsoFwFyApWjSJi9RGFkUXlDSSWEuiQVJ2VMNX6AkCtLuivUD3vU6",
  "76BFaqlEgIF6YG3IwM98M3uMOG_CAYSXrFBxbohUYrLQlgWOeWBWTHv38MbojWo0iMDSGdC0",
  "qly6lsVSTdh0FVXQlYirB8efzp6-jCyHLts-A7yDI2IKsTMBBqbRKS1G6gnatci3WRQuOSqW",
  "ka-wZEipLA_5uh1RYNy30w9k48MfBGRhS0d40FXhwxpCqLTiu5zdgUI2dZ9eqtgV4JkpDe_Y",
  "MEPoDQOj3gMXy8hCAQZSxq9xBOomkbWoy46BjPOf20i26-zF-rf6p9fvLw6_v38AgtJXGguP",
  "8_4Mhp1q7pluVOPlbEtptFs4YMqUr4Yqv3oAhURvSbhVj226MsaJriXNwnATdAUPWhdQdNzF",
  "JqHaQkyybTn3f6Su03Sq9WmrnWGHt2nDPkyYYG1NOqo_GCiuTSaIqT1YiJ88WTRV7997M9-9",
  "nvh_Hkw_rHAxaWFnn4NH-kNTBUOqgl_ru8uJYr8IhIHzy6uXyWMDpEHDaA17cvjoWEA0BUQ9",
  "4e744FjAdAqZPgOXh__qeOVOtcS4nqnG2BY8_xHRPsXHmRhMf-_1f",
].join("");

describe("buildWeekSharePayload / buildMonthSharePayload", () => {
  // Mon 2026-06-29 … Sun 2026-07-05: a week split between June and July.
  const days = Array.from({ length: 7 }, (_, i) => new Date(2026, 5, 29 + i));
  const albumsByDate = {
    "2026-06-30": album({ id: "itunes-jun", date: "2026-06-30", genre: "Jazz", rating: 2 }),
    "2026-07-02": album({ id: "itunes-jul", date: "2026-07-02", rating: 4 }),
  };
  const owner = { username: "listener", themeLabel: "🎧 Daily" };

  it("blanks the other month's days when split, and counts only the labelled month", () => {
    const payload = buildWeekSharePayload({
      days,
      labelDate: new Date(2026, 6, 1),
      splitByMonth: true,
      albumsByDate,
      ...owner,
    });
    expect(payload.title).toBe("July · Week 1");
    expect(payload.cells.map((c) => c.outOfMonth)).toEqual([true, true, false, false, false, false, false]);
    expect(payload.cells[1].album).toBeUndefined();
    expect(payload.cells[3].album?.id).toBe("itunes-jul");
    expect(payload.stats).toEqual({ count: 1, genres: 1, avg: "4.0" });
    expect(weekSharePayloadSchema.safeParse(payload).success).toBe(true);
  });

  it("keeps the whole week when continuous, without the private fields", () => {
    const payload = buildWeekSharePayload({
      days,
      labelDate: days[0],
      splitByMonth: false,
      albumsByDate,
      ...owner,
    });
    expect(payload.title).toBe("June · Week 5");
    expect(payload.cells.filter((c) => c.album).map((c) => c.album?.id)).toEqual(["itunes-jun", "itunes-jul"]);
    expect(payload.cells[1].album).not.toHaveProperty("note");
  });

  it("lays the month out as the board does, with only that month's stats", () => {
    const payload = buildMonthSharePayload({
      anchor: new Date(2026, 6, 15),
      albums: Object.values(albumsByDate),
      albumsByDate,
      ...owner,
    });
    expect(payload.title).toBe("July · 2026");
    expect(payload.numWeeks).toBe(5);
    expect(payload.cells).toHaveLength(35);
    // The June 30 cell is outside July: no album, even though one is logged there.
    expect(payload.cells[1]).toEqual({ dayNum: 30, inMonth: false, album: undefined });
    expect(payload.cells.filter((c) => c.album).map((c) => c.album?.id)).toEqual(["itunes-jul"]);
    expect(payload.stats.count).toBe(1);
    expect(monthSharePayloadSchema.safeParse(payload).success).toBe(true);
  });
});
