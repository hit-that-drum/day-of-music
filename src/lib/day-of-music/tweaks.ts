// tweaks.ts — the Tweaks panel settings (visual theme, typography, layout),
// persisted per device so they survive reloads. Shared by the app shell, the
// panel, and share-links (a share link snapshots the sharer's look).
// Client-side only (it reads localStorage and exports a hook); imported by
// client modules, share-links.ts included.

import { makeJsonStore, useStore } from "@/lib/day-of-music/local-store";
import type { AestheticKey, TypeKey } from "@/lib/day-of-music/appearance";

export type Tweaks = {
  aesthetic: AestheticKey;
  typography: TypeKey;
  /** When on, weeks never span two months: a week that crosses a month
   *  boundary is shown as two separate pages (e.g. "December — Week 5" then
   *  "January — Week 1"). Off keeps the continuous Mon–Sun week. */
  weekSplit: boolean;
};

export const DEFAULT_TWEAKS: Tweaks = {
  aesthetic: "editorial",
  typography: "editorial",
  weekSplit: false,
};

// A localStorage store read through useSyncExternalStore: the server renders
// the defaults and the client swaps in the saved value after mount, so there's
// no hydration mismatch. Bump the version suffix if the Tweaks shape changes
// incompatibly.
export const tweaksStore = makeJsonStore<Tweaks>("dom.tweaks.v1", DEFAULT_TWEAKS, (saved) => {
  const s = saved as Partial<Tweaks>;
  // Copy only active settings so retired keys from older saved blobs do not
  // remain in the live snapshot.
  return {
    aesthetic: s.aesthetic ?? DEFAULT_TWEAKS.aesthetic,
    typography: s.typography ?? DEFAULT_TWEAKS.typography,
    weekSplit: s.weekSplit ?? DEFAULT_TWEAKS.weekSplit,
  };
});

export function useTweaks(): Tweaks {
  return useStore(tweaksStore);
}

export function setTweak<K extends keyof Tweaks>(key: K, value: Tweaks[K]): void {
  tweaksStore.set({ ...tweaksStore.getSnapshot(), [key]: value });
}
