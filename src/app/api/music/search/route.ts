// /api/music/search — proxy for the free iTunes Search API.
//
// No auth or API key required. Results are mapped to a compact shape the
// client can turn into an Album. Identical queries are cached for an hour to
// stay well under the iTunes rate limit (~20 calls/min).
//
// The iTunes catalog IDs are Apple Music catalog IDs, so this can later be
// swapped for the (paid) Apple Music API without changing the client.

import { z } from "zod";

const searchParamsSchema = z.object({
  q: z.string().trim().min(1),
  type: z.enum(["album", "artist", "track"]).default("album"),
  limit: z.coerce.number().int().min(1).max(20).default(12),
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
    year: releaseDate ? new Date(releaseDate).getFullYear() : 0,
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

  const itunesUrl = new URL("https://itunes.apple.com/search");
  itunesUrl.searchParams.set("term", q);
  itunesUrl.searchParams.set("media", "music");
  itunesUrl.searchParams.set("entity", ENTITY_BY_TYPE[type]);
  itunesUrl.searchParams.set("limit", String(limit));
  itunesUrl.searchParams.set("country", country.toUpperCase());

  let response: Response;
  try {
    // Cache identical queries for an hour (iTunes rate limit is ~20/min).
    response = await fetch(itunesUrl, { next: { revalidate: 3600 } });
  } catch {
    return Response.json({ error: "Music search failed." }, { status: 502 });
  }

  if (!response.ok) {
    return Response.json(
      { error: "Music search failed." },
      { status: response.status === 403 ? 429 : 502 },
    );
  }

  // iTunes serves JSON with a text/javascript content type; parse manually.
  let results: ITunesResult[];
  try {
    const body = JSON.parse(await response.text()) as { results?: ITunesResult[] };
    results = body.results ?? [];
  } catch {
    return Response.json({ error: "Music search failed." }, { status: 502 });
  }

  return Response.json({
    results: results
      .map(mapResult)
      .filter((r): r is MusicSearchResult => r !== null),
  });
}
