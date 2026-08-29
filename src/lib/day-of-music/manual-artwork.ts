// manual-artwork.ts — cover pictures the user supplies for manually logged
// music. Shared by the Add flow (picking a cover for a new manual entry) and
// Day Detail's Info editor (replacing that cover later), so both squeeze the
// picture through the same budget instead of drifting apart.
//
// The picture has no address to link to, so it lives in the album metadata as a
// JPEG data URL. Data URLs also keep the share cards' export canvas untainted.

// journal_entries.album is capped at 64 KiB by the database. Manual artwork is
// embedded in that JSON as a data URL, so leave enough room for the rest of the
// album metadata (including non-ASCII titles/artists) before persisting it.
const MANUAL_ART_MAX_BYTES = 48 * 1024;

function compressManualArtwork(img: HTMLImageElement): string | null {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const sourceWidth = img.naturalWidth || img.width;
  const sourceHeight = img.naturalHeight || img.height;
  if (!sourceWidth || !sourceHeight) return null;

  const maxDimensions = [600, 480, 384, 320, 256, 192, 128, 96];
  const qualities = [0.82, 0.7, 0.58, 0.46];
  let smallest = "";

  for (const maxDimension of maxDimensions) {
    const scale = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight));
    canvas.width = Math.max(1, Math.round(sourceWidth * scale));
    canvas.height = Math.max(1, Math.round(sourceHeight * scale));
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    for (const quality of qualities) {
      const candidate = canvas.toDataURL("image/jpeg", quality);
      if (!candidate.startsWith("data:image/jpeg")) continue;
      smallest = candidate;
      if (new Blob([candidate]).size <= MANUAL_ART_MAX_BYTES) return candidate;
    }
  }

  // The 96 px fallback is normally only a few KiB. If a browser still emits
  // an unexpectedly large payload, omit the optional artwork instead of
  // sending a row the database is guaranteed to reject.
  return smallest && new Blob([smallest]).size <= MANUAL_ART_MAX_BYTES ? smallest : null;
}

/** Read a picked image file into a cover data URL that fits the album blob.
 *  Resolves to null when the file can't be read, decoded, or shrunk enough —
 *  callers fall back to the typographic tile. */
export function readManualArtwork(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onerror = () => resolve(null);
    reader.onload = () => {
      const src = typeof reader.result === "string" ? reader.result : "";
      if (!src) {
        resolve(null);
        return;
      }
      const img = new Image();
      img.onload = () => resolve(compressManualArtwork(img));
      img.onerror = () => resolve(null);
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}

/** True for music the user typed in by hand — the only entries whose cover
 *  picture is theirs to change (catalog albums carry Apple Music artwork). */
export function isManualAlbum(a: { id: string; format: string }): boolean {
  return a.id.startsWith("manual-") || a.format === "Manual";
}
