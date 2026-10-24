import { describe, expect, it } from "vitest";

import { artworkSrcSet } from "@/lib/day-of-music/artwork-size";

const base = "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/07/60/ba/x/634904078164.png/";

describe("artworkSrcSet", () => {
  it("offers smaller renditions of an Apple artwork URL, then the URL itself", () => {
    expect(artworkSrcSet(`${base}600x600bb.jpg`)).toBe(
      `${base}200x200bb.jpg 200w, ${base}300x300bb.jpg 300w, ${base}400x400bb.jpg 400w, ` +
        `${base}600x600bb.jpg 600w`,
    );
  });

  it("never offers a rendition at or above the stored width", () => {
    expect(artworkSrcSet(`${base}300x300bb.jpg`)).toBe(
      `${base}200x200bb.jpg 200w, ${base}300x300bb.jpg 300w`,
    );
    expect(artworkSrcSet(`${base}100x100bb.jpg`)).toBeUndefined();
  });

  // These load through src unchanged: a manual cover lives in the album as a
  // data: URL, and only Apple's CDN is known to render sizes on request.
  it("leaves every other picture alone", () => {
    expect(artworkSrcSet("data:image/jpeg;base64,AAAA")).toBeUndefined();
    expect(artworkSrcSet("https://i.scdn.co/image/ab67616d0000b273")).toBeUndefined();
    expect(artworkSrcSet("https://example.com/a/600x600bb.jpg")).toBeUndefined();
    expect(artworkSrcSet(`${base}600x600bb.jpg?x=1`)).toBeUndefined();
  });
});
