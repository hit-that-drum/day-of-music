// themes.ts — themed lanes for the journal (e.g. "New finds", "On repeat").
// Theme definitions sync with the account (user_metadata) for signed-in users,
// or live in localStorage for guests / local mode. The "active" theme (which
// tab you're viewing) is always per-device localStorage.

"use client";

import { useSyncExternalStore } from "react";

import { useAuth } from "@/components/day-of-music/auth-provider";
import { makeJsonStore, makeStringStore } from "@/lib/day-of-music/local-store";

export type Theme = { id: string; name: string; emoji: string };

export const DEFAULT_THEME_ID = "daily";

// New users start with a single lane; they add more in Profile. Existing
// entries migrate to "daily" (see migration), matching this default id.
export const DEFAULT_THEMES: Theme[] = [{ id: "daily", name: "Daily", emoji: "🎧" }];

/** Clamp an active-theme id to one that still exists: a stale id (its theme was
 *  deleted) falls back to the first theme. Shared so the tabs and the board
 *  agree on which lane is active. */
export function resolveActiveTheme(themes: Theme[], activeTheme: string): string {
  return themes.some((t) => t.id === activeTheme)
    ? activeTheme
    : themes[0]?.id ?? DEFAULT_THEME_ID;
}

// localStorage stores live in local-store.ts (hydration-safe, shared with
// profile.ts).
const activeStore = makeStringStore("dom.activeTheme.v1", DEFAULT_THEME_ID);
const localThemesStore = makeJsonStore<Theme[]>("dom.themes.v1", DEFAULT_THEMES);

/** Theme definitions + a single save(). Synced to the account when signed in. */
export function useThemes(): {
  themes: Theme[];
  saveThemes: (themes: Theme[]) => void;
  synced: boolean;
} {
  const { configured, user, updateUserMetadata } = useAuth();
  const localThemes = useSyncExternalStore(
    localThemesStore.subscribe,
    localThemesStore.getSnapshot,
    localThemesStore.getServerSnapshot,
  );

  if (configured && user) {
    const raw = user.user_metadata?.themes;
    const themes = Array.isArray(raw) && raw.length ? (raw as Theme[]) : DEFAULT_THEMES;
    return { themes, saveThemes: (t) => void updateUserMetadata({ themes: t }), synced: true };
  }
  return {
    themes: localThemes.length ? localThemes : DEFAULT_THEMES,
    saveThemes: localThemesStore.set,
    synced: false,
  };
}

/** The active theme id (which lane is being viewed) + setter. Per-device. */
export function useActiveTheme(): { activeTheme: string; setActiveTheme: (id: string) => void } {
  const activeTheme = useSyncExternalStore(
    activeStore.subscribe,
    activeStore.getSnapshot,
    activeStore.getServerSnapshot,
  );
  return { activeTheme, setActiveTheme: activeStore.set };
}
