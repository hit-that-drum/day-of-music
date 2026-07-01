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

import dayjs from "dayjs";
import { z } from "zod";

import type { AlbumDetail, TrackItem } from "@/lib/day-of-music/music-types";

const lookupParamsSchema = z.object({
  // Accept either a bare collectionId ("1234567") or the app's prefixed form
  // ("itunes-1234567"); we extract the digits below.
  id: z.string().trim().min(1),
  country: z
    .string()
    .regex(/^[a-zA-Z]{2}$/, "country must be a 2-letter code")
    .default("US"),
});

type ITunesResult = {
  wrapperType?: string;
  kind?: string;
  collectionId?: number;
  trackId?: number;
  collectionName?: string;
  trackName?: string;
  trackCensoredName?: string;
  artistName?: string;
  primaryGenreName?: string;
  releaseDate?: string;
  artworkUrl100?: string;
  trackCount?: number;
  discNumber?: number;
  trackNumber?: number;
};

// AlbumDetail / TrackItem are shared with the client (music-types.ts) so the
// route's JSON shape and the client's expected shape can't drift.

function collectionIdFromParam(raw: string): string | null {
  const match = raw.match(/(\d+)/);
  return match ? match[1] : null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = lookupParamsSchema.safeParse(
    Object.fromEntries(url.searchParams),
  );

  if (!parsed.success) {
    return Response.json(
      {
        error: "Invalid lookup parameters.",
        issues: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

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
  const storefronts = [...new Set([country.toUpperCase(), "US", "KR", "JP", "GB"])];

  async function lookupIn(store: string, id: string): Promise<ITunesResult[] | null> {
    const itunesUrl = new URL("https://itunes.apple.com/lookup");
    itunesUrl.searchParams.set("id", id);
    itunesUrl.searchParams.set("entity", "song");
    itunesUrl.searchParams.set("country", store);
    // Normalize text (e.g. genre names) to English regardless of storefront.
    itunesUrl.searchParams.set("lang", "en_us");
    try {
      // Cache identical lookups for an hour (iTunes rate limit is ~20/min).
      const resp = await fetch(itunesUrl, { next: { revalidate: 3600 } });
      if (!resp.ok) return null;
      const body = JSON.parse(await resp.text()) as { results?: ITunesResult[] };
      return body.results ?? [];
    } catch {
      return null;
    }
  }

  function buildTrackItems(r: ITunesResult[], coll: ITunesResult): TrackItem[] {
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

  // Find an edition of an album (by name + artist) that actually has tracks.
  // Used when the requested id resolves to a songless collection.
  // NOTE: worst case this is sequential I/O — up to (storefronts × 3 candidate)
  // lookups, i.e. ~15 round-trips — but it only runs on the rare songless-
  // collection fallback and short-circuits on the first edition with tracks, so
  // it's left serial for now. Parallelize per-store if it becomes a latency hot
  // spot.
  const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  async function findAlbumWithTracks(
    artist: string,
    name: string,
  ): Promise<{ collection: ITunesResult; trackItems: TrackItem[] } | null> {
    if (!artist || !name) return null;
    for (const store of storefronts) {
      let albums: ITunesResult[];
      try {
        const searchUrl = new URL("https://itunes.apple.com/search");
        searchUrl.searchParams.set("term", `${artist} ${name}`);
        searchUrl.searchParams.set("entity", "album");
        searchUrl.searchParams.set("limit", "15");
        searchUrl.searchParams.set("country", store);
        searchUrl.searchParams.set("lang", "en_us");
        const resp = await fetch(searchUrl, { next: { revalidate: 3600 } });
        if (!resp.ok) continue;
        albums = (JSON.parse(await resp.text()).results ?? []) as ITunesResult[];
      } catch {
        continue;
      }
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

  // Recover an album's tracklist from a storefront's SEARCH index. Some stores
  // (notably KR) return no individual songs from the album LOOKUP yet still
  // index those songs for search — so we search the artist's songs and keep the
  // ones on this exact album, which gives the localized (e.g. Korean) titles +
  // their track order. The full album name makes a poor search term (special
  // chars match nothing), so we search by artist and filter by collection id.
  // Also surfaces the album's localized title (`collectionName`): the lookup may
  // romanize it ("JAMONG SALGU CLUB") while the song rows carry the Korean
  // original ("자몽살구클럽").
  type RecoveredAlbum = { tracks: TrackItem[]; collectionName?: string };
  async function tracksViaSearch(
    store: string,
    artist: string,
    targetCollectionId: number,
  ): Promise<RecoveredAlbum> {
    if (!artist || !Number.isFinite(targetCollectionId)) return { tracks: [] };
    try {
      const searchUrl = new URL("https://itunes.apple.com/search");
      searchUrl.searchParams.set("term", artist);
      searchUrl.searchParams.set("media", "music");
      searchUrl.searchParams.set("entity", "song");
      searchUrl.searchParams.set("limit", "200");
      searchUrl.searchParams.set("country", store);
      // No lang override → titles come back in the storefront's own language.
      const resp = await fetch(searchUrl, { next: { revalidate: 3600 } });
      if (!resp.ok) return { tracks: [] };
      const results = (JSON.parse(await resp.text()).results ?? []) as ITunesResult[];
      const onAlbum = results.filter((x) => x.collectionId === targetCollectionId);
      return {
        tracks: buildTrackItems(onAlbum, onAlbum[0] ?? ({} as ITunesResult)),
        collectionName: onAlbum[0]?.collectionName,
      };
    } catch {
      return { tracks: [] };
    }
  }

  // Prefer a storefront that returns the album AND usable tracks. Some stores
  // list an album (trackCount > 0) without individually-available songs, so if
  // a store yields no tracks we keep trying the other storefronts; only fall
  // back to a collection-only result if none of them have tracks.
  let collection: ITunesResult | undefined;
  let trackItems: TrackItem[] = [];
  let fallbackCollection: ITunesResult | undefined;
  let fallbackTrackItems: TrackItem[] = [];
  // The album's metadata in the listener's own storefront (the first entry, as
  // the list is country-first). We display title/artist from here even when the
  // tracklist had to come from a fallback store — so a KR listener sees
  // "방탄소년단", not the "BTS" of whichever store happened to carry the songs.
  let preferredCollection: ITunesResult | undefined;
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

  // Ask the listener's storefront's SONG index about this album. It serves two
  // purposes, so we run it whenever the album exists in that store (not only on
  // the fallback path) — that keeps the Day Detail title consistent with the
  // search results, which always localize:
  //   1. Title: the lookup may romanize the album name ("JAMONG SALGU CLUB")
  //      while the song rows carry the localized one ("자몽살구클럽").
  //   2. Tracks: if our tracklist came from a *fallback* store (wrong language),
  //      swap in the localized one — but only when it's at least as complete, so
  //      we never trade a full English tracklist for a partial localized one.
  let localizedTitle: string | undefined;
  if (preferredStore && displayArtist) {
    const localized = await tracksViaSearch(preferredStore, displayArtist, Number(collectionId));
    if (localized.collectionName) localizedTitle = localized.collectionName;
    if (
      trackStore !== preferredStore &&
      localized.tracks.length > 0 &&
      localized.tracks.length >= trackItems.length
    ) {
      trackItems = localized.tracks;
    }
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
    year: releaseDate ? dayjs(releaseDate).year() : 0,
    releaseDate,
    artworkUrl: collection.artworkUrl100?.replace("100x100bb", "600x600bb") ?? "",
    trackCount: collection.trackCount ?? tracks.length,
    tracks,
    trackItems: localizedTrackItems,
  };

  return Response.json({ detail });
}
