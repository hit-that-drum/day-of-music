import { afterEach, describe, expect, it, vi } from "vitest";

import { itunesFetch, withItunesCalls } from "@/lib/day-of-music/itunes-lookup";

/** A fake upstream that answers `upstream.status` — change it mid-test. */
function stubUpstream(status: number) {
  const upstream = { status };
  const fetch = vi.fn(async () =>
    upstream.status === 200
      ? Response.json({ results: [{ trackId: 1 }] })
      : new Response("", { status: upstream.status }),
  );
  vi.stubGlobal("fetch", fetch);
  return { fetch, upstream };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("itunesFetch", () => {
  it.each([403, 429])("skips the rest of a request's calls after a %i", async (status) => {
    const { fetch, upstream } = stubUpstream(status);
    await withItunesCalls(async () => {
      expect(await itunesFetch("search", { term: "a", country: "KR" })).toBeNull();
      upstream.status = 200;
      expect(await itunesFetch("search", { term: "a", country: "US" })).toBeNull();
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  // The next request may be one Next's Data Cache answers without calling
  // Apple at all, so a rate-limited request must not fail it.
  it("leaves other requests alone", async () => {
    const { fetch, upstream } = stubUpstream(403);
    await withItunesCalls(() => itunesFetch("search", { term: "a" }));

    upstream.status = 200;
    await expect(withItunesCalls(() => itunesFetch("search", { term: "b" }))).resolves.toEqual([
      { trackId: 1 },
    ]);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  // Apple's edge answers 502 to some malformed lookups — no reason to give up
  // on the request's other stores.
  it("keeps calling after any other failure", async () => {
    const { fetch, upstream } = stubUpstream(502);
    await withItunesCalls(async () => {
      expect(await itunesFetch("lookup", { id: "1" })).toBeNull();
      upstream.status = 200;
      expect(await itunesFetch("lookup", { id: "1" })).toEqual([{ trackId: 1 }]);
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
