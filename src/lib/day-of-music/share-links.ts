// share-links.ts — public share links for the share cards.
//
// "Copy link" freezes what the poster shows into a payload snapshot:
// signed-in users store it in Supabase under a random token (/s/<token>),
// guests get the week payload compressed into the URL itself (/s?d=...).
// The payload's schemas, types and URL codec live in share-payload.ts, which
// the public page also validates with. Albums pass through an explicit
// allowlist — notes and tracklists never leave the device. Covers the user
// uploaded themselves have no address to link to, so the picture travels in
// the payload (share-artwork.ts shrinks it to fit the transport).

import type { Album } from "@/lib/day-of-music/data";
import type { JournalAlbum } from "@/lib/day-of-music/journal";
import type { AlbumStats } from "@/lib/day-of-music/album-stats";
import {
  base64url,
  encodeGuestParam,
  shareThemeSchema,
  type SharedAlbum,
  type SharePayload,
  type ShareTheme,
  type StatsSharePayload,
  type WeekSharePayload,
} from "@/lib/day-of-music/share-payload";
import {
  GUEST_PARAM_BUDGET,
  STORED_PAYLOAD_BUDGET,
  fitArtwork,
  payloadBytes,
} from "@/lib/day-of-music/share-artwork";
import { tweaksStore } from "@/lib/day-of-music/tweaks";
import { getSupabaseBrowserClient, runQuery } from "@/lib/supabase/client";

// ── Building payloads ───────────────────────────────────────────────────────

/** Explicit allowlist of album fields that may leave the device. Notes,
 *  tracklists and everything else stay out by construction. Artwork passes
 *  through exactly as the board has it — whatever picture the user sees on the
 *  week board is the picture on the poster and in the saved image. Filtering
 *  it by scheme happens only when a link is minted (share-artwork.ts), where
 *  it actually matters. */
export function sanitizeAlbum(a: Album | JournalAlbum): SharedAlbum {
  return {
    id: a.id,
    date: a.date,
    title: a.title,
    titleKo: a.titleKo,
    artist: a.artist,
    genre: a.genre,
    year: a.year,
    format: a.format,
    cover: a.cover,
    ...(a.artworkUrl ? { artworkUrl: a.artworkUrl } : {}),
    ...(a.kind ? { kind: a.kind } : {}),
    ...(a.albumTitle ? { albumTitle: a.albumTitle } : {}),
    rating: a.rating,
    ...("theme" in a && a.theme ? { theme: a.theme } : {}),
  };
}

export function buildStatsSharePayload(args: {
  title: string;
  username: string;
  themeLabel: string;
  sub: string;
  showFives: boolean;
  stats: AlbumStats<JournalAlbum>;
}): StatsSharePayload {
  const { stats } = args;
  return {
    v: 1,
    kind: "stats",
    title: args.title,
    username: args.username,
    themeLabel: args.themeLabel,
    theme: readShareTheme(),
    sub: args.sub,
    showFives: args.showFives,
    stats: {
      total: stats.total,
      avgRating: stats.avgRating,
      avgRatingNum: stats.avgRatingNum,
      genreCount: stats.genreCount,
      topGenres: stats.topTenGenres.slice(0, 5),
      fiveStarCount: stats.fives.length,
      fives: args.showFives ? stats.fives.map(sanitizeAlbum) : [],
    },
  };
}

/** The sharer's current visual tweaks. Validated like the public page will:
 *  a value the schema doesn't know would make the whole link fail to parse,
 *  so it's left out instead (the page then falls back to editorial). */
export function readShareTheme(): ShareTheme | undefined {
  const { aesthetic, typography } = tweaksStore.getSnapshot();
  const parsed = shareThemeSchema.safeParse({ aesthetic, typography });
  return parsed.success ? parsed.data : undefined;
}

// ── Creating links ──────────────────────────────────────────────────────────

/** 128-bit random token — the entire secret of a share link. */
function randomToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return base64url(bytes);
}

function requireClient() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase is not configured");
  return supabase;
}

/** Store the snapshot under a fresh token and return the public URL.
 *  Every click mints a new link; old links keep their frozen snapshot. */
export async function createSharedCardLink(
  userId: string,
  payload: SharePayload,
): Promise<string> {
  const supabase = requireClient();
  const token = randomToken();
  // Uploaded covers ride inside the row, so shrink them to fit its size check
  // before the insert (a no-op for payloads that only point at https artwork).
  const stored = await fitArtwork(payload, payloadBytes, STORED_PAYLOAD_BUDGET);
  await runQuery(
    "shared_cards insert",
    supabase.from("shared_cards").insert({ user_id: userId, token, kind: stored.kind, payload: stored }),
  );
  return shareUrlForToken(token);
}

/** The public address of a stored link. */
export function shareUrlForToken(token: string): string {
  return `${window.location.origin}/s/${token}`;
}

// ── Managing stored links (the Profile page) ────────────────────────────────

/** How many links one account may keep. The database enforces it — the
 *  shared-card trigger in 0007_abuse_limits.sql — so change the two together. */
export const MAX_SHARED_CARDS = 200;

/** A stored link as the manager lists it (public.shared_cards, snake_case). */
export type SharedCardRow = {
  id: string;
  token: string;
  kind: SharePayload["kind"];
  created_at: string;
};

/** How many links the account holds — a count, no rows fetched. */
export async function countSharedCards(userId: string): Promise<number> {
  const { count } = await runQuery(
    "shared_cards count",
    requireClient()
      .from("shared_cards")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
  );
  return count ?? 0;
}

/** The account's links, newest first (at most the cap, so all of them). */
export async function listSharedCards(userId: string): Promise<SharedCardRow[]> {
  const { data } = await runQuery(
    "shared_cards list",
    requireClient()
      .from("shared_cards")
      .select("id, token, kind, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(MAX_SHARED_CARDS),
  );
  return (data ?? []) as SharedCardRow[];
}

/** Delete one link; it stops resolving at once. */
export async function deleteSharedCard(userId: string, id: string): Promise<void> {
  await runQuery(
    "shared_cards delete",
    requireClient().from("shared_cards").delete().eq("id", id).eq("user_id", userId),
  );
}

// ── Guest links (payload lives in the URL, nothing stored) ──────────────────

/** Guest link for the week card: the payload itself, deflated into the URL.
 *  "1"/"0" prefix marks compressed vs plain, for old browsers. */
export async function createGuestWeekLink(payload: WeekSharePayload): Promise<string> {
  // A guest link is the payload, so an uploaded cover only survives if it fits
  // in the URL — much tighter than a stored row, and shrunk to match.
  const fitted = await fitArtwork(
    payload,
    async (p) => (await encodeGuestParam(p)).length,
    GUEST_PARAM_BUDGET,
  );
  return `${window.location.origin}/s?d=${await encodeGuestParam(fitted)}`;
}
