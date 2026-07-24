// save-card.ts — shared "export this node as a PNG" helper for the share cards.
// Embeds the real web fonts (fetched as CSS, handed to html-to-image) so the
// saved image matches the on-screen layout exactly; falls back to skipping
// fonts if the font CSS can't be fetched, so the save never hard-fails.

import { toPng } from "html-to-image";
import { toast } from "sonner";

import { googleFontsHref } from "@/lib/day-of-music/theme";

// The reference export width — matches --dom-modal-w (the poster's full-size
// desktop layout). Every export is rendered at this width so the saved image is
// identical regardless of the viewer's screen size, instead of shrinking with
// the modal on narrow screens.
const EXPORT_WIDTH = 1100;

export async function saveCardAsImage(node: HTMLElement, filename: string): Promise<void> {
  // Render the poster on an off-screen stage locked to the reference width. The
  // stage is a child of the node's own parent, so the clone stays inside the
  // themed .dom-root subtree and inherits every CSS var (--panel, --line, the
  // theme colors …) exactly as on screen — it just lays out at a fixed width.
  const parent = node.parentElement ?? document.body;
  const stage = document.createElement("div");
  stage.style.cssText = `position:fixed;left:-100000px;top:0;width:${EXPORT_WIDTH}px;pointer-events:none;`;
  const clone = node.cloneNode(true) as HTMLElement;
  clone.style.width = `${EXPORT_WIDTH}px`;
  clone.style.maxWidth = "none";
  stage.appendChild(clone);
  parent.appendChild(stage);

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
    await toPng(clone, opts);
    const dataUrl = await toPng(clone, opts);
    const link = document.createElement("a");
    link.download = filename;
    link.href = dataUrl;
    link.click();
    toast.success("Image saved");
  } catch {
    toast.error("Couldn't save image");
  } finally {
    parent.removeChild(stage);
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
