import { afterEach, describe, expect, it, vi } from "vitest";

/** A fresh itunes-lookup (its rate-limit pause is module state) over a fake
 *  upstream that answers `upstream.status` — change it mid-test. */
async function withUpstream(status: number) {
  vi.resetModules();
  const upstream = { status };
  const fetch = vi.fn(async () =>
    upstream.status === 200
      ? Response.json({ results: [{ trackId: 1 }] })
      : new Response("", { status: upstream.status }),
  );
  vi.stubGlobal("fetch", fetch);
  const { itunesFetch } = await import("@/lib/day-of-music/itunes-lookup");
  return { itunesFetch, fetch, upstream };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("itunesFetch", () => {
  it.each([403, 429])("stops calling Apple for a minute after a %i", async (status) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const { itunesFetch, fetch, upstream } = await withUpstream(status);
    expect(await itunesFetch("search", { term: "a" })).toBeNull();

    upstream.status = 200;
    expect(await itunesFetch("search", { term: "b" })).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);

    vi.setSystemTime(Date.now() + 60_000);
    expect(await itunesFetch("search", { term: "c" })).toEqual([{ trackId: 1 }]);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  // Apple's edge answers 502 to some malformed lookups — that must not pause
  // the search for everyone.
  it("keeps calling after any other failure", async () => {
    const { itunesFetch, fetch, upstream } = await withUpstream(502);
    expect(await itunesFetch("lookup", { id: "1" })).toBeNull();

    upstream.status = 200;
    expect(await itunesFetch("lookup", { id: "1" })).toEqual([{ trackId: 1 }]);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
