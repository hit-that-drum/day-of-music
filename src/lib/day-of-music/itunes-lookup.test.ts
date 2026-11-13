import { afterEach, describe, expect, it, vi } from "vitest";

import {
  itunesFetch,
  localizeFromEdition,
  withItunesCalls,
  type ITunesRow,
} from "@/lib/day-of-music/itunes-lookup";

/** A fake upstream that answers `upstream.status` — change it mid-test. */
function stubUpstream(status: number) {
  const upstream = { status };
  const fetch = vi.fn(async () =>
    upstream.status === 200
      ? Response.json({ results: [{ trackId: 1 }] })
      : new Response("", { status: upstream.status }),
  );
  vi.stubGlobal("fetch", fetch);
  return { fetch, upstream };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("itunesFetch", () => {
  it.each([403, 429])("skips the rest of a request's calls after a %i", async (status) => {
    const { fetch, upstream } = stubUpstream(status);
    await withItunesCalls(async () => {
      expect(await itunesFetch("search", { term: "a", country: "KR" })).toBeNull();
      upstream.status = 200;
      expect(await itunesFetch("search", { term: "a", country: "US" })).toBeNull();
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  // The next request may be one Next's Data Cache answers without calling
  // Apple at all, so a rate-limited request must not fail it.
  it("leaves other requests alone", async () => {
    const { fetch, upstream } = stubUpstream(403);
    await withItunesCalls(() => itunesFetch("search", { term: "a" }));

    upstream.status = 200;
    await expect(withItunesCalls(() => itunesFetch("search", { term: "b" }))).resolves.toEqual([
      { trackId: 1 },
    ]);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  // Apple's edge answers 502 to some malformed lookups — no reason to give up
  // on the request's other stores.
  it("keeps calling after any other failure", async () => {
    const { fetch, upstream } = stubUpstream(502);
    await withItunesCalls(async () => {
      expect(await itunesFetch("lookup", { id: "1" })).toBeNull();
      upstream.status = 200;
      expect(await itunesFetch("lookup", { id: "1" })).toEqual([{ trackId: 1 }]);
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});

/** A fake KR store answering an artist's albums and songs (lookup?id=<artist>
 *  &entity=album|song). The rows below are as measured, Nov 2026. */
function stubArtistLookups(albums: ITunesRow[], songs: ITunesRow[]) {
  const fetch = vi.fn(async (input: URL | string) => {
    const entity = new URL(String(input)).searchParams.get("entity");
    return Response.json({ results: entity === "album" ? albums : songs });
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

const song = (row: ITunesRow): ITunesRow => ({
  wrapperType: "track",
  kind: "song",
  discNumber: 1,
  ...row,
});
const album = (row: ITunesRow): ITunesRow => ({ wrapperType: "collection", ...row });

describe("localizeFromEdition", () => {
  // The other stores' edition of Wonder Girls' "REBOOT" (1698940016) isn't in
  // KR at all; KR sells its own (1025660436), with Korean titles.
  const reboot = album({
    collectionId: 1698940016,
    collectionName: "REBOOT",
    artistId: 289029151,
    artistName: "Wonder Girls",
  });
  const rebootSongs = [
    { trackId: 1698940022, trackNumber: 1, trackName: "Baby Don't Play", trackTimeMillis: 211973 },
    { trackId: 1698940268, trackNumber: 9, trackName: "OPPA", trackTimeMillis: 213387 },
    { trackId: 1698940273, trackNumber: 10, trackName: "Faded Love", trackTimeMillis: 233307 },
  ].map(song);
  const krAlbums: ITunesRow[] = [
    { wrapperType: "artist", artistId: 289029151, artistName: "Wonder Girls" },
    album({ collectionId: 1025660436, collectionName: "REBOOT", artistName: "Wonder Girls" }),
  ];
  const krRebootSong = (row: ITunesRow) =>
    song({ collectionId: 1025660436, collectionName: "REBOOT", artistName: "Wonder Girls", ...row });

  it("names the songs as the store's own edition does", async () => {
    // The store's 200 songs needn't include every one: track 1 is missing here.
    const fetch = stubArtistLookups(krAlbums, [
      krRebootSong({ trackId: 1025660454, trackNumber: 9, trackName: "오빠", trackTimeMillis: 213387 }),
      krRebootSong({ trackId: 1025660455, trackNumber: 10, trackName: "사랑이 떠나려 할 때", trackTimeMillis: 233307 }),
    ]);

    const names = await localizeFromEdition("KR", reboot, rebootSongs);

    expect(names?.title).toBe("REBOOT");
    expect(names?.artist).toBe("Wonder Girls");
    expect(Object.fromEntries(names?.tracks ?? [])).toEqual({
      1698940268: { name: "오빠", artist: "Wonder Girls" },
      1698940273: { name: "사랑이 떠나려 할 때", artist: "Wonder Girls" },
    });
    const asked = fetch.mock.calls.map(([url]) => new URL(String(url)).searchParams);
    expect(asked.map((p) => [p.get("id"), p.get("entity"), p.get("country")])).toEqual([
      ["289029151", "album", "KR"],
      ["289029151", "song", "KR"],
    ]);
  });

  it("matches a song encoded a second longer", async () => {
    // "Why So Lonely - Single": the two editions' songs differ by up to 986 ms.
    const kr = { collectionId: 1131122327, collectionName: "Why So Lonely - Single" };
    stubArtistLookups(
      [album({ ...kr, artistName: "Wonder Girls" })],
      [
        song({ ...kr, trackNumber: 1, trackName: "Why So Lonely", trackTimeMillis: 207693 }),
        song({ ...kr, trackNumber: 2, trackName: "아름다운 그대에게", trackTimeMillis: 192587 }),
      ],
    );

    const names = await localizeFromEdition(
      "KR",
      { ...reboot, collectionId: 1698667522, collectionName: "Why So Lonely - Single" },
      [
        song({ trackId: 1698667531, trackNumber: 1, trackName: "Why So Lonely", trackTimeMillis: 206707 }),
        song({ trackId: 1698667541, trackNumber: 2, trackName: "Beautiful Boy", trackTimeMillis: 191942 }),
      ],
    );

    expect(names?.tracks.get(1698667541)?.name).toBe("아름다운 그대에게");
  });

  it("finds an edition named without the store's ' - Single'", async () => {
    // TWICE's "MOONLIGHT SUNRISE - Single" (US) is "MOONLIGHT SUNRISE" in KR.
    const kr = { collectionId: 1664364638, collectionName: "MOONLIGHT SUNRISE", artistName: "TWICE" };
    stubArtistLookups(
      [album(kr)],
      [song({ ...kr, trackNumber: 1, trackName: "MOONLIGHT SUNRISE", trackTimeMillis: 180320 })],
    );

    const names = await localizeFromEdition(
      "KR",
      album({ collectionId: 1660143942, collectionName: "MOONLIGHT SUNRISE - Single", artistId: 1203816887 }),
      [song({ trackId: 1660144217, trackNumber: 1, trackName: "MOONLIGHT SUNRISE", trackTimeMillis: 180320 })],
    );

    expect(names?.title).toBe("MOONLIGHT SUNRISE");
    expect(names?.tracks.get(1660144217)?.name).toBe("MOONLIGHT SUNRISE");
  });

  it("leaves an edition whose songs sit in other places alone", async () => {
    // A bonus intro moves every song down one: each place now holds another
    // song, of another length.
    stubArtistLookups(krAlbums, [
      krRebootSong({ trackId: 1, trackNumber: 1, trackName: "Intro", trackTimeMillis: 60000 }),
      krRebootSong({ trackId: 2, trackNumber: 10, trackName: "오빠", trackTimeMillis: 213387 }),
    ]);

    await expect(localizeFromEdition("KR", reboot, rebootSongs)).resolves.toBeNull();
  });

  it("asks for no songs when the store has no album by that name", async () => {
    const fetch = stubArtistLookups(krAlbums.slice(0, 1), []);

    await expect(localizeFromEdition("KR", reboot, rebootSongs)).resolves.toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
