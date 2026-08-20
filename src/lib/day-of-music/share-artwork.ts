// share-artwork.ts — fit user-uploaded cover art into a share link.
//
// Covers picked from the device are JPEG data URLs living inside the payload
// (no server copy to point at), so a share link has to carry the picture
// itself. Full-size ones blow both link budgets — the shared_cards column
// check and the guest link's URL length — so before a link is minted the
// artwork is re-encoded smaller until the whole payload fits. Only if even
// the smallest step is too big does the cover drop back to the typographic
// tile. Remote https artwork is left alone: it costs a few dozen bytes.

import { isShareableArtwork } from "@/lib/day-of-music/share-links";
import type { SharedAlbum, SharePayload } from "@/lib/day-of-music/share-links";

/** Longest edge (px) tried in order. Posters render covers at ~150px (week)
 *  and ~110px (month), so 256 already carries more detail than they show. */
const STEPS = [256, 160, 96];
const QUALITY = 0.62;

/** Payload bytes a stored share row may use. The column check caps jsonb at
 *  64KB; the slack covers jsonb's per-key overhead. */
export const STORED_PAYLOAD_BUDGET = 50_000;

/** Characters the guest link's `d` param may use. Well under the 16384 the
 *  decoder accepts, because the whole URL rides in the request line and Node
 *  rejects header blocks over 16KB. */
export const GUEST_PARAM_BUDGET = 8_000;

function isDataArtwork(url: string | undefined): url is string {
  return !!url && url.startsWith("data:");
}

function albumsOf(p: SharePayload): SharedAlbum[] {
  if (p.kind === "stats") return p.stats.fives;
  return p.cells.flatMap((c) => (c.album ? [c.album] : []));
}

/** Rebuild the payload with every album passed through `fn`. The cast is the
 *  price of keeping the caller's exact payload kind: each branch reconstructs
 *  the same shape it destructured. */
function mapAlbums<T extends SharePayload>(p: T, fn: (a: SharedAlbum) => SharedAlbum): T {
  if (p.kind === "stats") {
    return { ...p, stats: { ...p.stats, fives: p.stats.fives.map(fn) } } as T;
  }
  // Week and month cells differ in their day fields but both hold an optional
  // album, which is all this walk touches.
  const cells = (p.cells as Array<{ album?: SharedAlbum }>).map((c) =>
    c.album ? { ...c, album: fn(c.album) } : c,
  );
  return { ...p, cells } as T;
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Re-encode one data URL with its longest edge at `max` px. Returns the
 *  original when the image can't be decoded — the size check then decides. */
function encode(img: HTMLImageElement, max: number, fallback: string): string {
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return fallback;
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", QUALITY);
}

/** Shrink the payload's uploaded covers until `size(payload) <= budget`,
 *  dropping them only as a last resort. Payloads without uploaded covers (and
 *  ones that already fit) come back untouched. */
export async function fitArtwork<T extends SharePayload>(
  payload: T,
  size: (p: T) => number | Promise<number>,
  budget: number,
): Promise<T> {
  // Artwork only this device can resolve would render as a broken box for the
  // person opening the link, so it goes back to the typographic tile.
  const sendable = mapAlbums(payload, (a) =>
    !a.artworkUrl || isShareableArtwork(a.artworkUrl) ? a : withoutArtwork(a),
  );
  const originals = [
    ...new Set(albumsOf(sendable).map((a) => a.artworkUrl).filter(isDataArtwork)),
  ];
  if (!originals.length) return sendable;
  if ((await size(sendable)) <= budget) return sendable;

  // Decode once, then re-encode from the full-size source at every step so
  // the steps don't stack lossy passes on top of each other.
  const decoded = new Map<string, HTMLImageElement | null>();
  await Promise.all(originals.map(async (src) => decoded.set(src, await loadImage(src))));

  for (const max of STEPS) {
    const scaled = new Map<string, string>();
    for (const src of originals) {
      const img = decoded.get(src);
      scaled.set(src, img ? encode(img, max, src) : src);
    }
    const next = mapAlbums(sendable, (a) => {
      const url = isDataArtwork(a.artworkUrl) ? scaled.get(a.artworkUrl) : undefined;
      return url ? { ...a, artworkUrl: url } : a;
    });
    if ((await size(next)) <= budget) return next;
  }

  return mapAlbums(sendable, (a) => (isDataArtwork(a.artworkUrl) ? withoutArtwork(a) : a));
}

function withoutArtwork(a: SharedAlbum): SharedAlbum {
  const stripped = { ...a };
  delete stripped.artworkUrl;
  return stripped;
}

/** Byte length of the payload as the server will store it. */
export function payloadBytes(p: SharePayload): number {
  return new TextEncoder().encode(JSON.stringify(p)).length;
}
