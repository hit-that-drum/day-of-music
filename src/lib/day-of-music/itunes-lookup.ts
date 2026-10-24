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
