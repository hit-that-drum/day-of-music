import { afterEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_TWEAKS } from "@/lib/day-of-music/tweaks";

/** Fresh module instances over a fake localStorage holding `saved` (the
 *  stores cache their first read, so each case needs its own copy). */
async function withSavedTweaks(saved: string | null) {
  vi.resetModules();
  const setItem = vi.fn();
  vi.stubGlobal("window", { localStorage: { getItem: () => saved, setItem } });
  const tweaks = await import("@/lib/day-of-music/tweaks");
  const shareLinks = await import("@/lib/day-of-music/share-links");
  return { ...tweaks, readShareTheme: shareLinks.readShareTheme, setItem };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("tweaksStore", () => {
  it("serves the defaults until something is saved", async () => {
    const { tweaksStore } = await withSavedTweaks(null);
    expect(tweaksStore.getSnapshot()).toEqual(DEFAULT_TWEAKS);
  });

  it("fills in settings missing from an older blob and drops retired ones", async () => {
    const { tweaksStore } = await withSavedTweaks(
      JSON.stringify({ aesthetic: "dark", density: "compact" }),
    );
    expect(tweaksStore.getSnapshot()).toEqual({ ...DEFAULT_TWEAKS, aesthetic: "dark" });
  });

  it("falls back to the defaults for unreadable storage", async () => {
    for (const saved of ["{not json", "null"]) {
      const { tweaksStore } = await withSavedTweaks(saved);
      expect(tweaksStore.getSnapshot()).toEqual(DEFAULT_TWEAKS);
    }
  });

  it("writes one setting through to storage under dom.tweaks.v1", async () => {
    const { tweaksStore, setTweak, setItem } = await withSavedTweaks(null);
    setTweak("weekSplit", true);
    expect(tweaksStore.getSnapshot()).toEqual({ ...DEFAULT_TWEAKS, weekSplit: true });
    expect(setItem).toHaveBeenCalledWith(
      "dom.tweaks.v1",
      JSON.stringify({ ...DEFAULT_TWEAKS, weekSplit: true }),
    );
  });
});

describe("readShareTheme", () => {
  it("snapshots only the look, not the layout settings", async () => {
    const { readShareTheme } = await withSavedTweaks(
      JSON.stringify({ aesthetic: "vibrant", typography: "display", weekSplit: true }),
    );
    expect(readShareTheme()).toEqual({ aesthetic: "vibrant", typography: "display" });
  });

  it("leaves out a value the public page's schema would reject", async () => {
    const { readShareTheme } = await withSavedTweaks(JSON.stringify({ aesthetic: "neon" }));
    expect(readShareTheme()).toBeUndefined();
  });
});
