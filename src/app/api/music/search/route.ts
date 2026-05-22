import { z } from "zod";

const searchParamsSchema = z.object({
  q: z.string().trim().min(1),
  type: z.enum(["album", "artist", "track"]).default("album"),
  limit: z.coerce.number().int().min(1).max(20).default(12),
});

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

  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return Response.json(
      { error: "Spotify access token is required." },
      { status: 401 },
    );
  }

  const spotifyUrl = new URL("https://api.spotify.com/v1/search");
  spotifyUrl.searchParams.set("q", parsed.data.q);
  spotifyUrl.searchParams.set("type", parsed.data.type);
  spotifyUrl.searchParams.set("limit", String(parsed.data.limit));

  const spotifyResponse = await fetch(spotifyUrl, {
    headers: {
      Authorization: authorization,
    },
    cache: "no-store",
  });

  const body = await spotifyResponse
    .json()
    .catch(() => ({ error: "Spotify request failed." }));

  return Response.json(body, { status: spotifyResponse.status });
}
