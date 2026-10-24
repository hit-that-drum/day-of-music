// /api/music/album — proxy for the free iTunes Lookup API.
//
// The Search API (/api/music/search) returns album-level metadata only, with
// no tracklist. To get the songs we look the album up by its catalog id with
// entity=song, which returns the collection object plus one row per track.
//
// No auth or API key required. Identical lookups are cached for an hour to stay
// well under the iTunes rate limit (~20 calls/min). Because iTunes catalog IDs
// are Apple Music catalog IDs, this can later be swapped for the (paid) Apple
// Music API without changing the client.

import { z } from "zod";

import { badRequest, countryParam } from "@/app/api/music/_shared";
import {
  hiResArtwork,
  itunesFetch,
  lookupByIds,
  storefrontsFor,
  withItunesCalls,
  yearOf,
  type ITunesRow,
} from "@/lib/day-of-music/itunes-lookup";
import type { AlbumDetail, TrackItem } from "@/lib/day-of-music/music-types";

const lookupParamsSchema = z.object({
  // Accept either a bare collectionId ("1234567") or the app's prefixed form
  // ("itunes-1234567"); we extract the digits below. Bounded like the search
  // params: the route is public.
  id: z.string().trim().min(1).max(64),
  country: countryParam,
});

// AlbumDetail / TrackItem are shared with the client (music-types.ts) so the
// route's JSON shape and the client's expected shape can't drift.

function collectionIdFromParam(raw: string): string | null {
  const match = raw.match(/(\d+)/);
  return match ? match[1] : null;
}

// An album and its songs in one store: the collection row plus a row per track.
function lookupIn(store: string, lookupId: string): Promise<ITunesRow[] | null> {
  // Normalize text (e.g. genre names) to English regardless of storefront.
  return itunesFetch("lookup", { id: lookupId, entity: "song", country: store, lang: "en_us" });
}

function buildTrackItems(r: ITunesRow[], coll: ITunesRow): TrackItem[] {
  return r
    .filter((x) => x.wrapperType === "track" && x.kind === "song")
    .sort(
      (a, b) =>
        (a.discNumber ?? 1) - (b.discNumber ?? 1) ||
        (a.trackNumber ?? 0) - (b.trackNumber ?? 0),
    )
    .filter((x) => x.trackId != null)
    .map((x) => ({
      trackId: x.trackId as number,
      name: x.trackCensoredName ?? x.trackName ?? "",
      artist: x.artistName ?? coll.artistName ?? "",
    }))
    .filter((t) => t.name.length > 0);
}

const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

// Find an edition of an album (by name + artist) that actually has tracks.
// Used when the requested id resolves to a songless collection.
// NOTE: worst case this is sequential I/O — up to (storefronts × 3 candidate)
// lookups, i.e. ~15 round-trips — but it only runs on the rare songless-
// collection fallback and short-circuits on the first edition with tracks, so
// it's left serial for now. Parallelize per-store if it becomes a latency hot
// spot.
async function findAlbumWithTracks(
  storefronts: string[],
  artist: string,
  name: string,
): Promise<{ collection: ITunesRow; trackItems: TrackItem[] } | null> {
  if (!artist || !name) return null;
  for (const store of storefronts) {
    const albums = await itunesFetch("search", {
      term: `${artist} ${name}`,
      entity: "album",
      limit: "15",
      country: store,
      lang: "en_us",
    });
    if (!albums) continue;
    // Same album name (normalized), fullest tracklist first.
    const candidates = albums
      .filter((a) => a.collectionId != null && normalize(a.collectionName ?? "") === normalize(name))
      .sort((a, b) => (b.trackCount ?? 0) - (a.trackCount ?? 0))
      .slice(0, 3);
    for (const c of candidates) {
      const r = await lookupIn(store, String(c.collectionId));
      if (!r) continue;
      const coll = r.find((x) => x.wrapperType === "collection");
      if (!coll) continue;
      const items = buildTrackItems(r, coll);
      if (items.length > 0) return { collection: coll, trackItems: items };
    }
  }
  return null;
}

/** The album as the storefronts answered it. */
type ResolvedCollection = {
  /** The edition the tracklist comes from. */
  collection: ITunesRow;
  trackItems: TrackItem[];
  /** The album as the first store that has it lists it — the listener's own,
   *  as the storefront list is country-first. Title/artist are shown from
   *  here even when the tracklist had to come from a fallback store, so a KR
   *  listener sees "방탄소년단", not the "BTS" of whichever store had the songs. */
  preferred: ITunesRow;
  preferredStore: string;
  /** The store the tracklist came from; undefined when none had songs. Not
   *  the listener's store → the titles are in a fallback language. */
  trackStore: string | undefined;
};

// Prefer a storefront that returns the album AND usable tracks. Some stores
// list an album (trackCount > 0) without individually-available songs, so if
// a store yields no tracks we keep trying the other storefronts; only fall
// back to a collection-only result (the first store's) if none have tracks.
async function resolveCollection(
  storefronts: string[],
  collectionId: string,
): Promise<ResolvedCollection | null> {
  let first: { collection: ITunesRow; store: string } | undefined;
  for (const store of storefronts) {
    const r = await lookupIn(store, collectionId);
    if (r === null) continue;
    const coll = r.find((x) => x.wrapperType === "collection");
    if (!coll) continue;
    first ??= { collection: coll, store };
    const items = buildTrackItems(r, coll);
    if (items.length > 0) {
      return {
        collection: coll,
        trackItems: items,
        preferred: first.collection,
        preferredStore: first.store,
        trackStore: store,
      };
    }
  }
  if (!first) return null;
  return {
    collection: first.collection,
    trackItems: [],
    preferred: first.collection,
    preferredStore: first.store,
    trackStore: undefined,
  };
}

// A tracklist from a *fallback* store is in that store's language — a KR
// listener got the US store's "Highway". Re-localize it into the listener's
// store by looking the songs up by TRACK id there (see itunes-lookup.ts for
// why that works when the album lookup doesn't), keeping the order; a song
// that store doesn't carry keeps its fallback title, so the list never shrinks.
// The same rows carry the album's localized name for the title.
async function relocalizeTracks(
  store: string,
  collection: ITunesRow,
  trackItems: TrackItem[],
): Promise<{ trackItems: TrackItem[]; localizedTitle: string | undefined }> {
  const rows = new Map<number, ITunesRow>();
  const found = await lookupByIds(
    store,
    trackItems.map((t) => t.trackId),
  );
  for (const x of found) {
    if (x.wrapperType === "track" && x.trackId != null) rows.set(x.trackId, x);
  }
  return {
    trackItems: trackItems.map((t) => {
      const row = rows.get(t.trackId);
      const name = row?.trackCensoredName ?? row?.trackName;
      return row && name ? { ...t, name, artist: row.artistName ?? t.artist } : t;
    }),
    localizedTitle: [...rows.values()].find(
      (x) => x.collectionId === collection.collectionId && x.collectionName,
    )?.collectionName,
  };
}

// All of one lookup's iTunes calls share a scope, so a 403 midway stops the
// rest (see withItunesCalls).
export function GET(request: Request) {
  return withItunesCalls(() => lookup(request));
}

async function lookup(request: Request) {
  const url = new URL(request.url);
  const parsed = lookupParamsSchema.safeParse(
    Object.fromEntries(url.searchParams),
  );

  if (!parsed.success) return badRequest("Invalid lookup parameters.", parsed.error);

  const { id, country } = parsed.data;
  const collectionId = collectionIdFromParam(id);
  if (!collectionId) {
    return Response.json(
      { error: "id must contain a numeric iTunes collection id." },
      { status: 400 },
    );
  }

  // An album only exists in the storefronts it was released in, and a recovered
  // entry carries no storefront (just the id). So try the requested store
  // first, then common fallbacks, and use the first that has the album.
  const storefronts = storefrontsFor(country);

  const resolved = await resolveCollection(storefronts, collectionId);
  if (!resolved) {
    return Response.json({ error: "Album not found." }, { status: 404 });
  }
  const { preferred, preferredStore } = resolved;
  let { collection, trackItems, trackStore } = resolved;

  // Some editions (regional masters, "single" variants) resolve to a collection
  // with no individually-available songs. If we got the album but no tracks,
  // find another edition with the same name + artist that does have tracks.
  if (trackItems.length === 0) {
    const alt = await findAlbumWithTracks(
      storefronts,
      collection.artistName ?? "",
      collection.collectionName ?? "",
    );
    if (alt) {
      collection = alt.collection;
      trackItems = alt.trackItems;
      trackStore = undefined; // sourced cross-store → not the listener's language
    }
  }

  // Title/artist from the listener's storefront when we found the album there;
  // the tracklist may still come from a fallback store.
  const displayArtist = preferred.artistName ?? collection.artistName ?? "";

  let localizedTitle: string | undefined;
  if (trackStore !== preferredStore && trackItems.length > 0) {
    ({ trackItems, localizedTitle } = await relocalizeTracks(preferredStore, collection, trackItems));
  }

  // A fallback tracklist carries that store's artist on each row (e.g. "BTS").
  // Re-localize the *main* artist to the listener's storefront; genuine guest
  // artists (which differ from the source album's artist) are left untouched.
  const sourceArtist = collection.artistName ?? "";
  const localizedTrackItems =
    displayArtist && sourceArtist && displayArtist !== sourceArtist
      ? trackItems.map((t) => (t.artist === sourceArtist ? { ...t, artist: displayArtist } : t))
      : trackItems;

  const tracks = localizedTrackItems.map((t) => t.name);

  const releaseDate = collection.releaseDate ?? "";
  const detail: AlbumDetail = {
    id: `itunes-${collection.collectionId}`,
    title: localizedTitle ?? preferred.collectionName ?? collection.collectionName ?? "",
    artist: displayArtist,
    genre: collection.primaryGenreName ?? "—",
    year: yearOf(releaseDate),
    releaseDate,
    artworkUrl: hiResArtwork(collection),
    trackCount: collection.trackCount ?? tracks.length,
    tracks,
    trackItems: localizedTrackItems,
  };

  return Response.json({ detail });
}
