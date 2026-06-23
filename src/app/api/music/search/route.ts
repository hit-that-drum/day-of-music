// /api/music/search — proxy for the free iTunes Search API.
//
// No auth or API key required. Results are mapped to a compact shape the
// client can turn into an Album. Identical queries are cached for an hour to
// stay well under the iTunes rate limit (~20 calls/min).
//
// The iTunes catalog IDs are Apple Music catalog IDs, so this can later be
// swapped for the (paid) Apple Music API without changing the client.

import dayjs from "dayjs";
import { z } from "zod";

const searchParamsSchema = z.object({
  q: z.string().trim().min(1),
  type: z.enum(["album", "artist", "track"]).default("album"),
  limit: z.coerce.number().int().min(1).max(200).default(12),
  country: z
    .string()
    .regex(/^[a-zA-Z]{2}$/, "country must be a 2-letter code")
    .default("US"),
});

const ENTITY_BY_TYPE = {
  album: "album",
  artist: "musicArtist",
  track: "song",
} as const;

type ITunesResult = {
  wrapperType?: string;
  collectionId?: number;
  trackId?: number;
  artistId?: number;
  collectionName?: string;
  trackName?: string;
  artistName?: string;
  primaryGenreName?: string;
  releaseDate?: string;
  artworkUrl100?: string;
  trackCount?: number;
};

export type MusicSearchResult = {
  id: string;
  title: string;
  artist: string;
  genre: string;
  year: number;
  releaseDate: string;
  artworkUrl: string;
  trackCount: number;
};

function mapResult(r: ITunesResult): MusicSearchResult | null {
  const rawId = r.collectionId ?? r.trackId ?? r.artistId;
  const title = r.collectionName ?? r.trackName ?? r.artistName;
  if (rawId == null || !title) return null;

  const releaseDate = r.releaseDate ?? "";
  return {
    id: `itunes-${rawId}`,
    title,
    artist: r.artistName ?? "",
    genre: r.primaryGenreName ?? "—",
    year: releaseDate ? dayjs(releaseDate).year() : 0,
    releaseDate,
    // Artwork URLs are templated; request a sharper 600x600 variant.
    artworkUrl: r.artworkUrl100?.replace("100x100bb", "600x600bb") ?? "",
    trackCount: r.trackCount ?? 0,
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = searchParamsSchema.safeParse(
    Object.fromEntries(url.searchParams),
  );

  if (!parsed.success) {
    return Response.json(
      {
        error: "Invalid search parameters.",
        issues: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const { q, type, limit, country } = parsed.data;

  // Search the user's preferred storefront first, then fall back through the
  // common stores (deduped). Returns the first store that yields any results,
  // so a region-specific release surfaces even if the preferred store is empty.
  const storefronts = [...new Set([country.toUpperCase(), "US", "KR", "JP", "GB"])];

  async function searchIn(store: string): Promise<MusicSearchResult[] | null> {
    const itunesUrl = new URL("https://itunes.apple.com/search");
    itunesUrl.searchParams.set("term", q);
    itunesUrl.searchParams.set("media", "music");
    itunesUrl.searchParams.set("entity", ENTITY_BY_TYPE[type]);
    itunesUrl.searchParams.set("limit", String(limit));
    itunesUrl.searchParams.set("country", store);
    // Normalize text (e.g. genre names) to English regardless of storefront.
    itunesUrl.searchParams.set("lang", "en_us");
    try {
      // Cache identical queries for an hour (iTunes rate limit is ~20/min).
      const resp = await fetch(itunesUrl, { next: { revalidate: 3600 } });
      if (!resp.ok) return null;
      const body = JSON.parse(await resp.text()) as { results?: ITunesResult[] };
      return (body.results ?? [])
        .map(mapResult)
        .filter((r): r is MusicSearchResult => r !== null);
    } catch {
      return null;
    }
  }

  // The album SEARCH returns a storefront's *romanized* title (e.g.
  // "JAMONG SALGU CLUB") while the same store's SONG search carries the
  // localized one ("자몽살구클럽"). One extra song query (in the store that
  // produced the results) builds a collectionId → localized-title map, so album
  // results read in the listener's language. Titles with no localized form, and
  // non-album searches, are left untouched.
  async function localizeAlbumTitles(
    results: MusicSearchResult[],
    store: string,
  ): Promise<MusicSearchResult[]> {
    if (type !== "album" || results.length === 0) return results;
    try {
      const songUrl = new URL("https://itunes.apple.com/search");
      songUrl.searchParams.set("term", q);
      songUrl.searchParams.set("media", "music");
      songUrl.searchParams.set("entity", "song");
      songUrl.searchParams.set("limit", "200");
      songUrl.searchParams.set("country", store);
      // No lang override → song rows carry the storefront's localized album name.
      const resp = await fetch(songUrl, { next: { revalidate: 3600 } });
      if (!resp.ok) return results;
      const songs = (JSON.parse(await resp.text()).results ?? []) as ITunesResult[];
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
    } catch {
      return results;
    }
  }

  let anyStoreReached = false;
  for (const store of storefronts) {
    const results = await searchIn(store);
    if (results === null) continue;
    anyStoreReached = true;
    if (results.length > 0) {
      return Response.json({ results: await localizeAlbumTitles(results, store) });
    }
  }

  // Every reachable store returned zero matches → empty list (not an error).
  if (anyStoreReached) return Response.json({ results: [] });
  return Response.json({ error: "Music search failed." }, { status: 502 });
}
