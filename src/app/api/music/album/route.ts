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

export type AlbumDetail = {
  id: string;
  title: string;
  artist: string;
  genre: string;
  year: number;
  releaseDate: string;
  artworkUrl: string;
  trackCount: number;
  /** Track names in disc/track order. */
  tracks: string[];
};

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

  const itunesUrl = new URL("https://itunes.apple.com/lookup");
  itunesUrl.searchParams.set("id", collectionId);
  itunesUrl.searchParams.set("entity", "song");
  itunesUrl.searchParams.set("country", country.toUpperCase());
  // Normalize text (e.g. genre names) to English regardless of storefront.
  itunesUrl.searchParams.set("lang", "en_us");

  let response: Response;
  try {
    // Cache identical lookups for an hour (iTunes rate limit is ~20/min).
    response = await fetch(itunesUrl, { next: { revalidate: 3600 } });
  } catch {
    return Response.json({ error: "Album lookup failed." }, { status: 502 });
  }

  if (!response.ok) {
    return Response.json(
      { error: "Album lookup failed." },
      { status: response.status === 403 ? 429 : 502 },
    );
  }

  // iTunes serves JSON with a text/javascript content type; parse manually.
  let results: ITunesResult[];
  try {
    const body = JSON.parse(await response.text()) as { results?: ITunesResult[] };
    results = body.results ?? [];
  } catch {
    return Response.json({ error: "Album lookup failed." }, { status: 502 });
  }

  const collection = results.find((r) => r.wrapperType === "collection");
  if (!collection) {
    return Response.json({ error: "Album not found." }, { status: 404 });
  }

  const tracks = results
    .filter((r) => r.wrapperType === "track" && r.kind === "song")
    .sort(
      (a, b) =>
        (a.discNumber ?? 1) - (b.discNumber ?? 1) ||
        (a.trackNumber ?? 0) - (b.trackNumber ?? 0),
    )
    .map((r) => r.trackCensoredName ?? r.trackName ?? "")
    .filter((name): name is string => name.length > 0);

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
  };

  return Response.json({ detail });
}
