// itunes-lookup.ts — iTunes helpers shared by the /api/music routes (album
// detail + search): the one fetch every iTunes call goes through, the
// storefront fallback order, row → field conversions, and the id lookups that
// re-localize results. Server-side only: plain fetches, no React.
//
// Why look things up by id: some storefronts — notably KR — answer an album
// lookup with the album but none of its songs, and the KR search index comes
// back empty for every query (observed Oct 2026; it used to carry the songs).
// So the routes end up with albums and tracklists from a fallback store
// (usually US), named in that store's language: "Highway", "JAMONG SALGU CLUB",
// "HANRORO". Looked up BY ID in the listener's store, the same items come back
// localized: song rows carry the Korean title ("하이웨이") and the album's
// Korean name ("자몽살구클럽" — the album row itself may stay romanized), album
// rows carry the Korean artist ("한로로"). Catalog ids are the same in every
// store, so ids from the fallback store resolve here; an item the store doesn't
// carry is simply missing from the result. Artist rows stay romanized in every
// store ("Ha Hyun Sang" even in KR), so an artist's name comes from their
// album rows instead.
//
// Not every album has one id everywhere, though: the KR store sells JYP's
// catalog (Wonder Girls, 2PM, TWICE…) as a Korean distributor's own edition,
// with its own album and track ids — Wonder Girls' "REBOOT" is 1025660436
// there and 1698940016 in the other stores. Looked up by id, the global edition
// isn't in KR at all, so its songs are named from that edition instead (see
// localizeFromEdition).

import { AsyncLocalStorage } from "node:async_hooks";

import dayjs from "dayjs";

/** One row of an iTunes Search or Lookup response: an artist, a collection
 *  (album) or a track, with the fields the /api/music routes read. */
export type ITunesRow = {
  wrapperType?: string;
  kind?: string;
  artistId?: number;
  collectionId?: number;
  trackId?: number;
  artistName?: string;
  collectionName?: string;
  trackName?: string;
  trackCensoredName?: string;
  primaryGenreName?: string;
  releaseDate?: string;
  artworkUrl100?: string;
  trackCount?: number;
  discNumber?: number;
  trackNumber?: number;
  trackTimeMillis?: number;
};

// Per request: the routes try store after store, so one that hangs must give
// way to the next rather than hold the whole response.
const ITUNES_TIMEOUT_MS = 8_000;

// Apple answers 403 (or 429) once this server is over its limit, ~20 calls a
// minute shared by every listener (they all reach Apple from this server's IP).
// Errors aren't cached, so a request that carries on store after store only
// spends 4-5 more calls and stretches the lockout: after one such answer, the
// rest of that request's calls fail at once, the way an unreachable store
// does. Per request on purpose — a pause shared by every request would also
// fail the ones Next's Data Cache answers without calling Apple. Not on 5xx:
// Apple's edge answers 502 to some malformed lookups.
const rateLimit = new AsyncLocalStorage<{ hit: boolean }>();

/** Run one route request's iTunes calls; after a 403/429 the rest of them are
 *  skipped (see above). Calls made outside it are never skipped. */
export function withItunesCalls<T>(handle: () => Promise<T>): Promise<T> {
  return rateLimit.run({ hit: false }, handle);
}

/** One iTunes Search or Lookup request. Identical requests are cached for an
 *  hour (the rate limit is ~20 calls/min). Resolves to the response's rows, or
 *  null when the store couldn't be reached, timed out, answered with an error,
 *  or Apple already rate-limited this request (see withItunesCalls). No lang is
 *  added: pass lang "en_us" for English text, or leave it out to get names in
 *  the store's own language. */
export async function itunesFetch(
  endpoint: "search" | "lookup",
  params: Record<string, string>,
): Promise<ITunesRow[] | null> {
  const request = rateLimit.getStore();
  if (request?.hit) return null;
  const url = new URL(`https://itunes.apple.com/${endpoint}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  try {
    // The signal only bounds the request; it isn't part of the cache key.
    const resp = await fetch(url, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(ITUNES_TIMEOUT_MS),
    });
    if (resp.status === 403 || resp.status === 429) {
      if (request) request.hit = true;
      return null;
    }
    if (!resp.ok) return null;
    const body = JSON.parse(await resp.text()) as { results?: ITunesRow[] };
    return body.results ?? [];
  } catch {
    return null;
  }
}

/** The storefronts to try, in order: the listener's own, then the common
 *  ones. An album only exists in the stores it was released in, and some
 *  stores list an album without its songs. */
export function storefrontsFor(country: string): string[] {
  return [...new Set([country.toUpperCase(), "US", "KR", "JP", "GB"])];
}

/** The year of an iTunes release date; 0 when there is none. */
export function yearOf(releaseDate: string): number {
  return releaseDate ? dayjs(releaseDate).year() : 0;
}

/** A row's artwork URL is templated by size: ask for a sharper 600x600. */
export function hiResArtwork(row: ITunesRow): string {
  return row.artworkUrl100?.replace("100x100bb", "600x600bb") ?? "";
}

/** A search result as far as localizing it goes; `id` is "itunes-<id>". */
type Named = { id: string; title: string; artist: string };

const itunesIdOf = (r: Named) => Number(r.id.replace(/^itunes-/, ""));

function itunesIds(results: Named[]): number[] {
  return results.map(itunesIdOf).filter((id) => Number.isInteger(id) && id > 0);
}

/** Look `ids` up in `store` — albums and songs may be mixed — with optional
 *  extra query params (entity=song&limit=1 → one song per album). One request
 *  per 150 ids (a lookup takes at least 200; this keeps the URL under ~2,000
 *  chars), so only a long list needs a second call; a failed batch just adds no
 *  rows. No lang override → names come back in the store's own language. */
export async function lookupByIds(
  store: string,
  ids: number[],
  params: Record<string, string> = {},
): Promise<ITunesRow[]> {
  const batches: number[][] = [];
  for (let i = 0; i < ids.length; i += 150) batches.push(ids.slice(i, i + 150));
  const rows = await Promise.all(
    batches.map(
      async (batch) =>
        (await itunesFetch("lookup", { id: batch.join(","), country: store, ...params })) ?? [],
    ),
  );
  return rows.flat();
}

/** Re-localize album search results that came from a fallback store
 *  (`fromStore`) into the listener's store (`toStore`): the album title from
 *  that store's song rows, the artist from its album rows. Two requests — one
 *  song id per album from the store that has the songs, then the albums plus
 *  those songs in the listener's store. A result the listener's store doesn't
 *  carry keeps its fallback names; order and every other field are untouched. */
export async function localizeAlbumsInto<R extends Named>(
  results: R[],
  fromStore: string,
  toStore: string,
): Promise<R[]> {
  const albumIds = itunesIds(results);
  if (fromStore === toStore || albumIds.length === 0) return results;

  const songIds = (
    await lookupByIds(fromStore, albumIds, { entity: "song", limit: "1" })
  )
    .filter((x) => x.wrapperType === "track" && x.trackId != null)
    .map((x) => x.trackId as number);

  const titleByAlbum = new Map<number, string>();
  const artistByAlbum = new Map<number, string>();
  for (const x of await lookupByIds(toStore, [...albumIds, ...songIds])) {
    if (x.collectionId == null) continue;
    if (x.wrapperType === "collection" && x.artistName) {
      artistByAlbum.set(x.collectionId, x.artistName);
    } else if (x.wrapperType === "track" && x.collectionName) {
      titleByAlbum.set(x.collectionId, x.collectionName);
    }
  }

  return results.map((r) => {
    const title = titleByAlbum.get(itunesIdOf(r));
    const artist = artistByAlbum.get(itunesIdOf(r));
    return title || artist
      ? { ...r, title: title ?? r.title, artist: artist ?? r.artist }
      : r;
  });
}

/** Re-localize song search results (ids are track ids) that came from a
 *  fallback store into the listener's store: each song's title and credited
 *  artist from its row there. One request. */
export async function localizeTracksInto<R extends Named>(
  results: R[],
  fromStore: string,
  toStore: string,
): Promise<R[]> {
  const trackIds = itunesIds(results);
  if (fromStore === toStore || trackIds.length === 0) return results;

  const byTrack = new Map<number, ITunesRow>();
  for (const x of await lookupByIds(toStore, trackIds)) {
    if (x.wrapperType === "track" && x.trackId != null)
      byTrack.set(x.trackId, x);
  }

  return results.map((r) => {
    const x = byTrack.get(itunesIdOf(r));
    return x?.trackName
      ? { ...r, title: x.trackName, artist: x.artistName ?? r.artist }
      : r;
  });
}

/** One recording on two editions can differ in length by up to a second — they
 *  were encoded apart ("Why So Lonely": 206,707 ms in the US, 207,693 in KR). */
const SAME_LENGTH_MS = 3_000;

/** An album name as two editions share it: case, spacing and a store's
 *  " - Single" / " - EP" tag aside ("MOONLIGHT SUNRISE - Single" in the US is
 *  "MOONLIGHT SUNRISE" in KR). */
function editionName(name = ""): string {
  return name
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/ - (single|ep)$/, "");
}

/** A song's place on its album: disc and track number. */
function placeOf(row: ITunesRow): string | undefined {
  return row.trackNumber == null ? undefined : `${row.discNumber ?? 1}-${row.trackNumber}`;
}

/** `tracks` matched to another edition's `songs` by place, keyed by track id:
 *  the song in the same place, about as long. Null unless nearly every place
 *  both editions fill agrees — a bonus track up front moves every song down
 *  one, and then the places mustn't hand out their neighbours' names. */
function matchByPlace(tracks: ITunesRow[], songs: ITunesRow[]): Map<number, ITunesRow> | null {
  const songAt = new Map<string, ITunesRow>();
  for (const song of songs) {
    const place = placeOf(song);
    if (place) songAt.set(place, song);
  }
  const matched = new Map<number, ITunesRow>();
  let shared = 0;
  for (const track of tracks) {
    const place = placeOf(track);
    const song = place ? songAt.get(place) : undefined;
    if (!song || track.trackId == null) continue;
    shared += 1;
    if (
      track.trackTimeMillis != null &&
      song.trackTimeMillis != null &&
      Math.abs(track.trackTimeMillis - song.trackTimeMillis) <= SAME_LENGTH_MS
    ) {
      matched.set(track.trackId, song);
    }
  }
  return shared > 0 && matched.size >= shared * 0.8 ? matched : null;
}

/** An album's names as a store gives them on its own edition of it. */
export type EditionNames = {
  /** Track id (on the album asked about) → that song's name and artist. */
  tracks: Map<number, { name: string; artist?: string }>;
  title?: string;
  artist?: string;
};

/** Name an album's songs (`tracks`, the song rows of `collection`) as `store`
 *  names them on its own edition, for a store that doesn't carry this album by
 *  id (see the top of this file). The edition is the artist's album there with
 *  the same name; each song is the one in the same place on it, about as long.
 *  Two requests, both per artist: the albums, then the songs — at most 200 of
 *  them, which covers most artists; a song it leaves out (on TWICE's older
 *  releases, say) keeps its name. Null when the store has no such edition or
 *  its songs don't line up. */
export async function localizeFromEdition(
  store: string,
  collection: ITunesRow,
  tracks: ITunesRow[],
): Promise<EditionNames | null> {
  const name = editionName(collection.collectionName);
  if (collection.artistId == null || !name || tracks.length === 0) return null;

  const editions = (
    await lookupByIds(store, [collection.artistId], { entity: "album", limit: "200" })
  ).filter(
    (x) =>
      x.wrapperType === "collection" &&
      x.collectionId != null &&
      editionName(x.collectionName) === name,
  );
  if (editions.length === 0) return null;

  const songs = await lookupByIds(store, [collection.artistId], {
    entity: "song",
    limit: "200",
  });
  let best: { edition: ITunesRow; matched: Map<number, ITunesRow> } | undefined;
  for (const edition of editions) {
    const matched = matchByPlace(
      tracks,
      songs.filter((x) => x.wrapperType === "track" && x.collectionId === edition.collectionId),
    );
    if (matched && matched.size > (best?.matched.size ?? 0)) best = { edition, matched };
  }
  if (!best) return null;

  const named = new Map<number, { name: string; artist?: string }>();
  for (const [trackId, song] of best.matched) {
    const songName = song.trackCensoredName ?? song.trackName;
    if (songName) named.set(trackId, { name: songName, artist: song.artistName });
  }
  // The song rows carry the album's localized name ("자몽살구클럽"); the album
  // row may keep the romanized one.
  const title = [...best.matched.values()].find((x) => x.collectionName)?.collectionName;
  return {
    tracks: named,
    title: title ?? best.edition.collectionName,
    artist: best.edition.artistName,
  };
}

/** Name artist search results (ids are artist ids) as `store` names them on
 *  their albums — the artist rows themselves stay romanized ("Ha Hyun Sang"
 *  even in KR) while the album rows say "하현상". One request for a few albums
 *  per artist; an artist the store has no albums for keeps the name it came
 *  with. Unlike albums and songs this applies to results from the listener's
 *  own store too, since that store's artist search is romanized as well. */
export async function localizeArtistsInto<R extends Named>(
  results: R[],
  store: string,
): Promise<R[]> {
  const artistIds = itunesIds(results);
  if (artistIds.length === 0) return results;

  const creditsByArtist = new Map<number, string[]>();
  const albums = await lookupByIds(store, artistIds, {
    entity: "album",
    limit: "5",
  });
  for (const x of albums) {
    if (x.wrapperType !== "collection" || x.artistId == null || !x.artistName)
      continue;
    const credits = creditsByArtist.get(x.artistId) ?? [];
    credits.push(x.artistName);
    creditsByArtist.set(x.artistId, credits);
  }

  return results.map((r) => {
    const name = artistNameFromCredits(creditsByArtist.get(itunesIdOf(r)));
    return name ? { ...r, title: name, artist: name } : r;
  });
}

/** The artist's own name among their albums' credits: the most common one,
 *  where a collaboration ("하현상 & Etham", "하현우, SoYou & 윤도현") also counts
 *  for the solo credit it starts with; ties go to the shorter name. */
function artistNameFromCredits(credits: string[] = []): string | undefined {
  const votes = new Map<string, number>();
  for (const name of credits) votes.set(name, (votes.get(name) ?? 0) + 1);
  for (const name of credits) {
    for (const solo of votes.keys()) {
      if (name.startsWith(`${solo} & `) || name.startsWith(`${solo}, `)) {
        votes.set(solo, (votes.get(solo) ?? 0) + 1);
      }
    }
  }
  return [...votes].sort(
    ([a, aVotes], [b, bVotes]) => bVotes - aVotes || a.length - b.length,
  )[0]?.[0];
}
