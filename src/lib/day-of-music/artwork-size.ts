// artwork-size.ts — let the browser load a cover at the size it is shown.
// iTunes artwork URLs end in a size template (…/600x600bb.jpg, see hiResArtwork
// in itunes-lookup.ts), and Apple's image CDN renders any size on request. The
// 600px file is ~120 KB against ~18 KB at 200px, so a 56px search thumbnail or
// a 59px month cell on a phone shouldn't download it. Cover pairs this srcset
// with a `sizes` saying how wide it is shown, and the browser picks.

/** Renditions offered below the stored one, smallest first. Few on purpose:
 *  covers shown at similar widths (a week cell, a month cell) then share one
 *  download instead of each fetching its own. */
const WIDTHS = [200, 300, 400];

const TEMPLATE = /^(https:\/\/[\w.-]+\.mzstatic\.com\/.+\/)(\d+)x\d+bb\.(\w+)$/;

/** A srcset of smaller renditions of an Apple artwork URL plus the URL itself
 *  at its own width; undefined for any other picture (a manual cover's data:
 *  URL, another host) or one already at the smallest width — those load
 *  through `src` as they are. */
export function artworkSrcSet(url: string): string | undefined {
  const match = TEMPLATE.exec(url);
  if (!match) return undefined;
  const [, base, width, ext] = match;
  const stored = Number(width);
  const smaller = WIDTHS.filter((w) => w < stored);
  if (!smaller.length) return undefined;
  return [...smaller.map((w) => `${base}${w}x${w}bb.${ext} ${w}w`), `${url} ${stored}w`].join(
    ", ",
  );
}
