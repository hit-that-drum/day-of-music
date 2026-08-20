// save-card.ts — shared "export this node as a PNG" helper for the share cards.
// Embeds the real web fonts (resolved to data URLs, handed to html-to-image) so
// the saved image matches the on-screen layout exactly; falls back to skipping
// fonts if they can't be fetched, so the save never hard-fails.

import { toPng } from "html-to-image";
import { toast } from "sonner";

import { googleFontsHref } from "@/lib/day-of-music/theme";

// The reference export width — matches --dom-modal-w (the poster's full-size
// desktop layout). Every export is rendered at this width so the saved image is
// identical regardless of the viewer's screen size, instead of shrinking with
// the modal on narrow screens.
const EXPORT_WIDTH = 1100;

// ── Web-font embedding ──────────────────────────────────────────────────────
//
// html-to-image takes `fontEmbedCSS` verbatim: it injects the string into the
// clone as a <style> and rasterizes the result through an SVG <foreignObject>
// loaded as an <img>. That context can't fetch anything external, so handing it
// Google's stylesheet as-is — ~140 remote url(…) references spanning six
// families and every unicode subset — embedded no fonts at all. The canvas fell
// back to system faces while the boxes had been measured with the real ones,
// which is the drift the Georgia fallbacks in day-of-music.css work around.
//
// Resolving the faces here fixes that. Only the ones this poster actually needs
// are kept — matched by family against the node's computed styles, and by
// unicode-range against the characters on the card, which drops the cyrillic /
// greek / vietnamese subsets Google ships alongside latin. A typical poster
// ends up with a handful of files, and both caches below are module-level, so
// the second toPng pass and every later export re-use them.

const fontCssCache = new Map<string, string>();
const fontFileCache = new Map<string, string>();

const normalizeFamily = (family: string): string =>
  family.trim().replace(/['"]/g, "").toLowerCase();

/** Every font-family named anywhere in the subtree's computed styles. */
function usedFontFamilies(node: HTMLElement): Set<string> {
  const families = new Set<string>();
  const collect = (el: Element) => {
    getComputedStyle(el)
      .fontFamily.split(",")
      .forEach((family) => families.add(normalizeFamily(family)));
  };
  collect(node);
  node.querySelectorAll("*").forEach(collect);
  return families;
}

/** True when a `unicode-range` value covers at least one of `codePoints`.
 *  Handles the three forms Google emits: U+41, U+400-45F, U+04??. */
function rangeCovers(range: string, codePoints: Set<number>): boolean {
  return range.split(",").some((part) => {
    const match = /^u\+([0-9a-f?]{1,6})(?:-([0-9a-f]{1,6}))?$/i.exec(part.trim());
    if (!match) return true; // unparseable → keep the face rather than lose it
    const start = parseInt(match[1].replace(/\?/g, "0"), 16);
    const end = match[2]
      ? parseInt(match[2], 16)
      : parseInt(match[1].replace(/\?/g, "f"), 16);
    for (const codePoint of codePoints) {
      if (codePoint >= start && codePoint <= end) return true;
    }
    return false;
  });
}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  // Chunked so a large font file can't blow the argument limit.
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

async function fontFileAsDataURL(url: string): Promise<string | null> {
  const cached = fontFileCache.get(url);
  if (cached) return cached;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const mime = res.headers.get("content-type") || "font/woff2";
    const dataUrl = `data:${mime};base64,${toBase64(await res.arrayBuffer())}`;
    fontFileCache.set(url, dataUrl);
    return dataUrl;
  } catch {
    return null;
  }
}

/** Swap each remote src in one @font-face block for its data URL. A file that
 *  won't load is left pointing at its URL — one missing face, not a failed
 *  export. */
async function inlineFontFace(block: string): Promise<string> {
  const urls = [...block.matchAll(/url\((https:\/\/[^)]+)\)/g)].map((m) => m[1]);
  const dataUrls = await Promise.all(urls.map(fontFileAsDataURL));
  return urls.reduce(
    (css, url, i) => (dataUrls[i] ? css.replace(url, dataUrls[i]) : css),
    block,
  );
}

/** Self-contained @font-face CSS for everything `node` renders, or undefined
 *  when there's nothing to embed (the caller then skips fonts). */
async function buildFontEmbedCSS(node: HTMLElement): Promise<string | undefined> {
  const href = googleFontsHref();
  let css = fontCssCache.get(href);
  if (css === undefined) {
    const res = await fetch(href);
    if (!res.ok) return undefined;
    css = await res.text();
    fontCssCache.set(href, css);
  }

  const families = usedFontFamilies(node);
  const codePoints = new Set<number>();
  for (const char of node.textContent ?? "") {
    const codePoint = char.codePointAt(0);
    if (codePoint !== undefined) codePoints.add(codePoint);
  }

  const needed = (css.match(/@font-face\s*{[^}]*}/g) ?? []).filter((block) => {
    const family = /font-family:\s*([^;]+);/i.exec(block)?.[1];
    if (!family || !families.has(normalizeFamily(family))) return false;
    const range = /unicode-range:\s*([^;]+);/i.exec(block)?.[1];
    return !range || rangeCovers(range, codePoints);
  });
  if (!needed.length) return undefined;

  return (await Promise.all(needed.map(inlineFontFace))).join("\n");
}

/** Nearest ancestor (inclusive) that isn't a containing block for fixed
 *  positioning — i.e. the first one with no transform of its own. */
function untransformedAncestor(from: HTMLElement | null): HTMLElement | null {
  let el = from;
  while (el && getComputedStyle(el).transform !== "none") {
    el = el.parentElement;
  }
  return el;
}

export async function saveCardAsImage(node: HTMLElement, filename: string): Promise<void> {
  // Render the poster on an off-screen stage locked to the reference width. The
  // stage hangs off the node's own ancestry, so the clone stays inside the
  // themed .dom-root subtree and inherits every CSS var (--panel, --line, the
  // theme colors …) exactly as on screen — it just lays out at a fixed width.
  // Skip past any transformed ancestor (PosterFit scales the preview down on a
  // phone): a transform makes `position: fixed` resolve against that element
  // instead of the viewport, which would drag the "off-screen" stage back into
  // view and scale it along with the preview.
  const parent = untransformedAncestor(node.parentElement) ?? document.body;
  const stage = document.createElement("div");
  stage.style.cssText = `position:fixed;left:-100000px;top:0;width:${EXPORT_WIDTH}px;pointer-events:none;`;
  const clone = node.cloneNode(true) as HTMLElement;
  clone.style.width = `${EXPORT_WIDTH}px`;
  clone.style.maxWidth = "none";
  stage.appendChild(clone);
  parent.appendChild(stage);

  try {
    // Measured off the clone, so the faces follow whatever typography pair the
    // stage is themed with and whatever text this card carries.
    let fontEmbedCSS: string | undefined;
    try {
      fontEmbedCSS = await buildFontEmbedCSS(clone);
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
