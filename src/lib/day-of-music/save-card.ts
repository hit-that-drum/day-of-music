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
    const dataUrl = await toPng(node, {
      pixelRatio: 2,
      cacheBust: true,
      ...(fontEmbedCSS ? { fontEmbedCSS } : { skipFonts: true }),
    });
    const link = document.createElement("a");
    link.download = filename;
    link.href = dataUrl;
    link.click();
    toast.success("Image saved");
  } catch {
    toast.error("Couldn't save image");
  }
}

export async function copyCurrentLink(): Promise<void> {
  try {
    await navigator.clipboard.writeText(window.location.href);
    toast.success("Link copied");
  } catch {
    toast.error("Couldn't copy link");
  }
}
