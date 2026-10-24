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
  yearOf,
  type ITunesRow,
} from "@/lib/day-of-music/itunes-lookup";
import type { AlbumDetail, TrackItem } from "@/lib/day-of-music/music-types";

const lookupParamsSchema = z.object({
  // Accept either a bare collectionId ("1234567") or the app's prefixed form
  // ("itunes-1234567"); we extract the digits below.
  id: z.string().trim().min(1),
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

export async function GET(request: Request) {
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

  // Find an edition of an album (by name + artist) that actually has tracks.
  // Used when the requested id resolves to a songless collection.
  // NOTE: worst case this is sequential I/O — up to (storefronts × 3 candidate)
  // lookups, i.e. ~15 round-trips — but it only runs on the rare songless-
  // collection fallback and short-circuits on the first edition with tracks, so
  // it's left serial for now. Parallelize per-store if it becomes a latency hot
  // spot.
  async function findAlbumWithTracks(
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

  // Prefer a storefront that returns the album AND usable tracks. Some stores
  // list an album (trackCount > 0) without individually-available songs, so if
  // a store yields no tracks we keep trying the other storefronts; only fall
  // back to a collection-only result if none of them have tracks.
  let collection: ITunesRow | undefined;
  let trackItems: TrackItem[] = [];
  let fallbackCollection: ITunesRow | undefined;
  let fallbackTrackItems: TrackItem[] = [];
  // The album's metadata in the listener's own storefront (the first entry, as
  // the list is country-first). We display title/artist from here even when the
  // tracklist had to come from a fallback store — so a KR listener sees
  // "방탄소년단", not the "BTS" of whichever store happened to carry the songs.
  let preferredCollection: ITunesRow | undefined;
  let preferredStore: string | undefined;
  // Which storefront the chosen tracklist came from — if it's not the listener's
  // own store, the track titles are in a fallback language and we try to recover.
  let trackStore: string | undefined;
  for (const store of storefronts) {
    const r = await lookupIn(store, collectionId);
    if (r === null) continue;
    const coll = r.find((x) => x.wrapperType === "collection");
    if (!coll) continue;
    if (!preferredCollection) {
      preferredCollection = coll;
      preferredStore = store;
    }
    const items = buildTrackItems(r, coll);
    if (items.length > 0) {
      collection = coll;
      trackItems = items;
      trackStore = store;
      break;
    }
    if (!fallbackCollection) {
      fallbackCollection = coll;
      fallbackTrackItems = items;
    }
  }
  if (!collection && fallbackCollection) {
    collection = fallbackCollection;
    trackItems = fallbackTrackItems;
  }

  if (!collection) {
    return Response.json({ error: "Album not found." }, { status: 404 });
  }

  // Some editions (regional masters, "single" variants) resolve to a collection
  // with no individually-available songs. If we got the album but no tracks,
  // find another edition with the same name + artist that does have tracks.
  if (trackItems.length === 0) {
    const alt = await findAlbumWithTracks(
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
  const display = preferredCollection ?? collection;
  const displayArtist = display.artistName ?? collection.artistName ?? "";

  // A tracklist from a *fallback* store is in that store's language — a KR
  // listener got the US store's "Highway". Re-localize it into the listener's
  // store by looking the songs up by TRACK id there (see itunes-lookup.ts for
  // why that works when the album lookup doesn't), keeping the order; a song
  // that store doesn't carry keeps its fallback title, so the list never shrinks.
  // The same rows carry the album's localized name for the title.
  let localizedTitle: string | undefined;
  if (preferredStore && trackStore !== preferredStore && trackItems.length > 0) {
    const sourceCollectionId = collection.collectionId;
    const rows = new Map<number, ITunesRow>();
    const found = await lookupByIds(
      preferredStore,
      trackItems.map((t) => t.trackId),
    );
    for (const x of found) {
      if (x.wrapperType === "track" && x.trackId != null) rows.set(x.trackId, x);
    }
    trackItems = trackItems.map((t) => {
      const row = rows.get(t.trackId);
      const name = row?.trackCensoredName ?? row?.trackName;
      return row && name ? { ...t, name, artist: row.artistName ?? t.artist } : t;
    });
    localizedTitle = [...rows.values()].find(
      (x) => x.collectionId === sourceCollectionId && x.collectionName,
    )?.collectionName;
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
    title: localizedTitle ?? display.collectionName ?? collection.collectionName ?? "",
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
