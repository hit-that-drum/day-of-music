// /api/music/search — proxy for the free iTunes Search API.
//
// No auth or API key required. Results are mapped to a compact shape the
// client can turn into an Album. Identical queries are cached for an hour to
// stay well under the iTunes rate limit (~20 calls/min).
//
// The iTunes catalog IDs are Apple Music catalog IDs, so this can later be
// swapped for the (paid) Apple Music API without changing the client.
//
// `type` defaults to album, the only kind the app's own client (searchMusic)
// asks for today. Artist and track searches are served, and localized the same
// way, for callers that need them — kept on purpose (379bfab), not dead code.

import { z } from "zod";

import { badRequest, countryParam } from "@/app/api/music/_shared";
import {
  hiResArtwork,
  itunesFetch,
  localizeAlbumsInto,
  localizeArtistsInto,
  localizeTracksInto,
  storefrontsFor,
  yearOf,
  type ITunesRow,
} from "@/lib/day-of-music/itunes-lookup";
import type { MusicSearchResult } from "@/lib/day-of-music/music-types";

const searchParamsSchema = z.object({
  q: z.string().trim().min(1),
  type: z.enum(["album", "artist", "track"]).default("album"),
  limit: z.coerce.number().int().min(1).max(200).default(12),
  country: countryParam,
});

const ENTITY_BY_TYPE = {
  album: "album",
  artist: "musicArtist",
  track: "song",
} as const;

function mapResult(
  r: ITunesRow,
  type: keyof typeof ENTITY_BY_TYPE,
): MusicSearchResult | null {
  // A song row also carries its album's id and name; a track search is after
  // the song itself, not one row per song naming its album.
  const rawId =
    type === "track" ? r.trackId : (r.collectionId ?? r.trackId ?? r.artistId);
  const title =
    type === "track" ? r.trackName : (r.collectionName ?? r.trackName ?? r.artistName);
  if (rawId == null || !title) return null;

  const releaseDate = r.releaseDate ?? "";
  return {
    id: `itunes-${rawId}`,
    title,
    artist: r.artistName ?? "",
    genre: r.primaryGenreName ?? "—",
    year: yearOf(releaseDate),
    releaseDate,
    artworkUrl: hiResArtwork(r),
    trackCount: r.trackCount ?? 0,
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = searchParamsSchema.safeParse(
    Object.fromEntries(url.searchParams),
  );

  if (!parsed.success) return badRequest("Invalid search parameters.", parsed.error);

  const { q, type, limit, country } = parsed.data;

  // Search the user's preferred storefront first, then fall back through the
  // common stores (deduped). Returns the first store that yields any results,
  // so a region-specific release surfaces even if the preferred store is empty.
  const preferred = country.toUpperCase();
  const storefronts = storefrontsFor(country);

  async function searchIn(store: string): Promise<MusicSearchResult[] | null> {
    const rows = await itunesFetch("search", {
      term: q,
      media: "music",
      entity: ENTITY_BY_TYPE[type],
      limit: String(limit),
      country: store,
      // Normalize text (e.g. genre names) to English regardless of storefront.
      lang: "en_us",
    });
    if (!rows) return null;
    return rows.map((r) => mapResult(r, type)).filter((r): r is MusicSearchResult => r !== null);
  }

  // The album SEARCH returns a storefront's *romanized* title (e.g.
  // "JAMONG SALGU CLUB") while the same store's SONG search carries the
  // localized one ("자몽살구클럽"). When the results come from the listener's own
  // store, one extra song query there builds a collectionId → localized-title
  // map, so album results read in the listener's language. Titles with no
  // localized form, and non-album searches, are left untouched.
  async function localizeAlbumTitles(
    results: MusicSearchResult[],
    store: string,
  ): Promise<MusicSearchResult[]> {
    if (type !== "album" || results.length === 0) return results;
    // No lang override → song rows carry the storefront's localized album name.
    const songs = await itunesFetch("search", {
      term: q,
      media: "music",
      entity: "song",
      limit: "200",
      country: store,
    });
    if (!songs) return results;
    const titleByCollection = new Map<number, string>();
    for (const s of songs) {
      if (s.collectionId != null && s.collectionName && !titleByCollection.has(s.collectionId)) {
        titleByCollection.set(s.collectionId, s.collectionName);
      }
    }
    if (titleByCollection.size === 0) return results;
    return results.map((r) => {
      const localized = titleByCollection.get(Number(r.id.replace("itunes-", "")));
      return localized ? { ...r, title: localized } : r;
    });
  }

  // Name the results the way the listener's store does (see itunes-lookup.ts).
  async function localize(
    results: MusicSearchResult[],
    store: string,
  ): Promise<MusicSearchResult[]> {
    // Artist rows are romanized even in the listener's own store ("Ha Hyun
    // Sang" in KR), so artists always take the name from their album rows.
    if (type === "artist") return localizeArtistsInto(results, preferred);
    if (store === preferred) return localizeAlbumTitles(results, store);
    // Results from a fallback store are named in that store's language — a KR
    // listener, whose own store's search comes back empty, got the US store's
    // "JAMONG SALGU CLUB" by "HANRORO" — so they're looked up by id in the
    // listener's store instead.
    return type === "album"
      ? localizeAlbumsInto(results, store, preferred)
      : localizeTracksInto(results, store, preferred);
  }

  let anyStoreReached = false;
  for (const store of storefronts) {
    const results = await searchIn(store);
    if (results === null) continue;
    anyStoreReached = true;
    if (results.length > 0) {
      return Response.json({ results: await localize(results, store) });
    }
  }

  // Every reachable store returned zero matches → empty list (not an error).
  if (anyStoreReached) return Response.json({ results: [] });
  return Response.json({ error: "Music search failed." }, { status: 502 });
}
