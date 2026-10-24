// share-payload.ts — what a share link carries, and the parts the public /s
// pages need to read it back: the zod schemas (a tampered link renders nothing
// instead of garbage), the payload types, and the guest links' URL codec.
// Server-safe — no DOM, no Supabase client, no React (the codec only needs
// Web APIs Node has too) — so the server-rendered /s pages import only this.
// Building payloads and minting links live in share-links.ts.

import { z } from "zod";

// ── Payload schemas ─────────────────────────────────────────────────────────

const coverSpecSchema = z.object({
  style: z.enum(["stack", "diag", "center", "split", "edge", "ring", "block", "ticker"]),
  bg: z.string().max(64),
  fg: z.string().max(64),
  accent: z.string().max(64),
});

/** Covers the user picked from their own device are stored as JPEG data URLs
 *  (add-flow downscales them) — there is no https address to point at, so the
 *  picture itself has to travel with the payload. Raster types only: these
 *  render on the public share pages, and SVG can carry markup. */
const dataImageUrl = /^data:image\/(?:png|jpe?g|webp|gif|avif);base64,[A-Za-z0-9+/]+={0,2}$/;

/** True for artwork that can survive the trip to someone else's browser: a
 *  remote https cover, or a self-contained raster data URL. Anything else
 *  (a blob: handle, a local path) only means something on this device, so
 *  share-artwork.ts drops it when a link is minted. The poster on this device
 *  renders whatever the board renders — see sanitizeAlbum. */
export function isShareableArtwork(url: string | undefined): url is string {
  return !!url && (url.startsWith("https://") || dataImageUrl.test(url));
}

/** Bound on an embedded cover. The real ceiling is the transport budget
 *  (share-artwork.ts shrinks artwork to fit the column / URL limits); this
 *  just keeps a hand-crafted payload from being unbounded. */
const MAX_DATA_ARTWORK = 120_000;

const artworkUrlSchema = z.union([
  z.url({ protocol: /^https$/ }).max(600),
  z.string().max(MAX_DATA_ARTWORK).regex(dataImageUrl),
]);

const sharedAlbumSchema = z.object({
  id: z.string().max(200),
  date: z.string().max(20),
  title: z.string().max(300),
  titleKo: z.string().max(300),
  artist: z.string().max(300),
  genre: z.string().max(100),
  year: z.number().int(),
  format: z.string().max(50),
  cover: coverSpecSchema,
  artworkUrl: artworkUrlSchema.optional(),
  kind: z.enum(["album", "track"]).optional(),
  albumTitle: z.string().max(300).optional(),
  rating: z.number().int().min(0).max(5),
  /** Theme lane id — only used as part of list keys on the stats poster. */
  theme: z.string().max(100).optional(),
});

// The sharer's visual theme, so the public page renders the card the way the
// sharer saw it. Falls back to editorial when absent or unknown.
export const shareThemeSchema = z.object({
  aesthetic: z.enum(["editorial", "minimal", "vibrant", "dark"]),
  typography: z.enum(["editorial", "modern", "display", "classic"]),
});

const shareBaseSchema = z.object({
  v: z.literal(1),
  title: z.string().max(200),
  username: z.string().max(100),
  themeLabel: z.string().max(120),
  theme: shareThemeSchema.optional(),
});

export const weekSharePayloadSchema = shareBaseSchema.extend({
  kind: z.literal("week"),
  cells: z
    .array(
      z.object({
        date: z.string().max(20),
        dayNum: z.number().int().min(1).max(31),
        dow: z.string().max(3),
        outOfMonth: z.boolean(),
        album: sharedAlbumSchema.optional(),
      }),
    )
    .length(7),
  stats: z.object({
    count: z.number().int().min(0),
    genres: z.number().int().min(0),
    avg: z.string().max(10),
  }),
});

export const monthSharePayloadSchema = shareBaseSchema.extend({
  kind: z.literal("month"),
  numWeeks: z.number().int().min(4).max(6),
  cells: z
    .array(
      z.object({
        dayNum: z.number().int().min(1).max(31),
        inMonth: z.boolean(),
        album: sharedAlbumSchema.optional(),
      }),
    )
    .max(42),
  stats: z.object({
    count: z.number().int().min(0),
    genres: z.number().int().min(0),
    avg: z.string().max(10),
  }),
});

export const statsSharePayloadSchema = shareBaseSchema.extend({
  kind: z.literal("stats"),
  sub: z.string().max(200),
  showFives: z.boolean(),
  stats: z.object({
    total: z.number().int().min(0),
    avgRating: z.string().max(10),
    avgRatingNum: z.number().min(0).max(5),
    genreCount: z.number().int().min(0),
    topGenres: z.array(z.tuple([z.string().max(100), z.number().int().min(0)])).max(5),
    /** Kept separate from `fives`: year cards show the count without embedding
     *  the full five-star album list. Optional for existing v1 share links. */
    fiveStarCount: z.number().int().min(0).optional(),
    fives: z.array(sharedAlbumSchema).max(200),
  }),
});

export const sharePayloadSchema = z.discriminatedUnion("kind", [
  weekSharePayloadSchema,
  monthSharePayloadSchema,
  statsSharePayloadSchema,
]);

export type SharedAlbum = z.infer<typeof sharedAlbumSchema>;
export type ShareTheme = z.infer<typeof shareThemeSchema>;
export type WeekSharePayload = z.infer<typeof weekSharePayloadSchema>;
export type MonthSharePayload = z.infer<typeof monthSharePayloadSchema>;
export type StatsSharePayload = z.infer<typeof statsSharePayloadSchema>;
export type SharePayload = z.infer<typeof sharePayloadSchema>;

/** One-line summary for the public page's meta description (text-only OG). */
export function shareDescription(p: SharePayload): string {
  const s =
    p.kind === "stats"
      ? `${p.stats.total} albums · ${p.stats.genreCount} genres · ★ ${p.stats.avgRating}`
      : `${p.stats.count} albums · ${p.stats.genres} genres · ★ ${p.stats.avg}`;
  return `@${p.username} · ${p.themeLabel} — ${s}`;
}

// ── Guest link codec (the payload lives in the URL, nothing stored) ──────────

export function base64url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlDecode(s: string): Uint8Array | null {
  try {
    const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

// Streams typed structurally so this compiles even if the TS lib lacks
// Compression/DecompressionStream; both exist in modern browsers and Node 18+.
type ByteTransform = { readable: ReadableStream<Uint8Array>; writable: WritableStream<Uint8Array> };
type StreamCtor = new (format: string) => ByteTransform;

async function pipeBytes(bytes: Uint8Array, ctor: StreamCtor | undefined): Promise<Uint8Array | null> {
  if (!ctor) return null;
  try {
    const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new ctor("deflate-raw"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch {
    return null;
  }
}

const streamGlobals = globalThis as unknown as {
  CompressionStream?: StreamCtor;
  DecompressionStream?: StreamCtor;
};

/** The `d` param: the payload deflated into base64url, with a "1"/"0" prefix
 *  marking compressed vs plain for browsers without CompressionStream. */
export async function encodeGuestParam(payload: WeekSharePayload): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const deflated = await pipeBytes(bytes, streamGlobals.CompressionStream);
  return deflated ? `1${base64url(deflated)}` : `0${base64url(bytes)}`;
}

/** Decode a guest link's `d` param back into an (unvalidated) payload.
 *  Callers must zod-parse the result. Returns null on any malformed input. */
export async function decodeGuestShareParam(d: string): Promise<unknown | null> {
  if (d.length < 2 || d.length > 16384) return null;
  const bytes = base64urlDecode(d.slice(1));
  if (!bytes) return null;
  const raw =
    d[0] === "1" ? await pipeBytes(bytes, streamGlobals.DecompressionStream) : bytes;
  if (!raw) return null;
  try {
    return JSON.parse(new TextDecoder().decode(raw)) as unknown;
  } catch {
    return null;
  }
}
