// save-card.ts — shared "export this node as a PNG" helper for the share cards.
// Embeds the real web fonts (fetched as CSS, handed to html-to-image) so the
// saved image matches the on-screen layout exactly; falls back to skipping
// fonts if the font CSS can't be fetched, so the save never hard-fails.

import { toPng } from "html-to-image";
import { toast } from "sonner";

import { googleFontsHref } from "@/lib/day-of-music/theme";

export async function saveCardAsImage(node: HTMLElement, filename: string): Promise<void> {
  try {
    let fontEmbedCSS: string | undefined;
    try {
      const res = await fetch(googleFontsHref());
      if (res.ok) fontEmbedCSS = await res.text();
    } catch {
      /* fall back to skipFonts below */
    }
    // Make sure web fonts are ready before we measure, so the frozen box sizes
    // match the rasterized text.
    try {
      await (document as Document & { fonts?: FontFaceSet }).fonts?.ready;
    } catch {
      /* fonts API unavailable — continue */
    }
    const opts = {
      pixelRatio: 2,
      cacheBust: true,
      ...(fontEmbedCSS ? { fontEmbedCSS } : { skipFonts: true }),
    };
    // First pass warms the clone's styles + decoded fonts; the second pass then
    // measures and rasterizes consistently. This is the documented html-to-image
    // workaround for first-render text drift (clipping / overlap).
    await toPng(node, opts);
    const dataUrl = await toPng(node, opts);
    const link = document.createElement("a");
    link.download = filename;
    link.href = dataUrl;
    link.click();
    toast.success("Image saved");
  } catch {
    toast.error("Couldn't save image");
  }
}

// Filename-safe slug: drop illegal chars, collapse whitespace to hyphens.
function slug(s: string): string {
  return (
    String(s)
      .trim()
      .replace(/[\\/:*?"<>|]+/g, "")
      .replace(/\s+/g, "-")
      .replace(/^-+|-+$/g, "") || "untitled"
  );
}

// "Day-of-Music_<parts...>_<timestamp>.png", e.g.
// Day-of-Music_New-finds_June_3_20260617-162005.png
export function shareFileName(parts: (string | number)[]): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  const ts =
    `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-` +
    `${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  return ["Day-of-Music", ...parts.map((x) => slug(String(x))), ts].join("_") + ".png";
}

export async function copyCurrentLink(): Promise<void> {
  try {
    await navigator.clipboard.writeText(window.location.href);
    toast.success("Link copied");
  } catch {
    toast.error("Couldn't copy link");
  }
}
