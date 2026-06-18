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

  // Prefer a storefront that returns the album AND usable tracks. Some stores
  // list an album (trackCount > 0) without individually-available songs, so if
  // a store yields no tracks we keep trying the other storefronts; only fall
  // back to a collection-only result if none of them have tracks.
  let collection: ITunesResult | undefined;
  let trackItems: TrackItem[] = [];
  let fallbackCollection: ITunesResult | undefined;
  let fallbackTrackItems: TrackItem[] = [];
  for (const store of storefronts) {
    const r = await lookupIn(store, collectionId);
    if (r === null) continue;
    const coll = r.find((x) => x.wrapperType === "collection");
    if (!coll) continue;
    const items = buildTrackItems(r, coll);
    if (items.length > 0) {
      collection = coll;
      trackItems = items;
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
    }
  }

  const tracks = trackItems.map((t) => t.name);

  const releaseDate = collection.releaseDate ?? "";
  const detail: AlbumDetail = {
    id: `itunes-${collection.collectionId}`,
    title: collection.collectionName ?? "",
    artist: collection.artistName ?? "",
    genre: collection.primaryGenreName ?? "—",
    year: releaseDate ? dayjs(releaseDate).year() : 0,
    releaseDate,
    artworkUrl: collection.artworkUrl100?.replace("100x100bb", "600x600bb") ?? "",
    trackCount: collection.trackCount ?? tracks.length,
    tracks,
    trackItems,
  };

  return Response.json({ detail });
}
