// local-store.ts — tiny localStorage-backed stores read via useSyncExternalStore
// so values survive reloads without a hydration mismatch. `makeStringStore`
// holds a raw string; `makeJsonStore` (de)serializes any JSON-able value. Both
// fall back to a default on the server and when storage is unavailable.

import { useSyncExternalStore } from "react";

// Every read below degrades to its default when storage is blocked, which is
// the right behaviour per-store but adds up to a badly broken app: the session
// supabase-js keeps here vanishes on reload, and the active theme resets to
// "daily" so a journal kept in another lane reads as empty. Safari blocks
// localStorage outright under "Block all cookies" and in private windows, so
// this is a real state to detect rather than a theoretical one. Callers use it
// to say so instead of leaving the user with a silently wrong app.
let storageWritable: boolean | null = null;

export function isLocalStorageAvailable(): boolean {
  if (storageWritable !== null) return storageWritable;
  if (typeof window === "undefined") return true; // SSR: don't warn
  try {
    const probe = "dom.storage-probe";
    window.localStorage.setItem(probe, probe);
    window.localStorage.removeItem(probe);
    storageWritable = true;
  } catch {
    storageWritable = false;
  }
  return storageWritable;
}

export type Store<T> = {
  getSnapshot: () => T;
  getServerSnapshot: () => T;
  subscribe: (cb: () => void) => () => void;
  set: (next: T) => void;
};

/** Read a store in a component: the server snapshot (the fallback) during SSR
 *  and hydration, the stored value right after — no hydration mismatch. */
export function useStore<T>(store: Store<T>): T {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
}

// Shared machinery: lazy-init snapshot, listener set, and a set() that writes
// through to storage and notifies subscribers. `load`/`save` adapt the value
// to/from its stored string form.
function makeStore<T>(
  load: () => T,
  save: (next: T) => void,
  fallback: T,
): Store<T> {
  // A `loaded` flag (rather than a null/undefined sentinel) so lazy-init works
  // correctly even when T itself can be null or undefined.
  let snapshot: T;
  let loaded = false;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: (): T => {
      if (!loaded) {
        snapshot = load();
        loaded = true;
      }
      return snapshot;
    },
    getServerSnapshot: (): T => fallback,
    subscribe: (cb: () => void): (() => void) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    set: (next: T): void => {
      snapshot = next;
      loaded = true;
      save(next);
      listeners.forEach((l) => l());
    },
  };
}

export function makeStringStore(
  key: string,
  fallback: string,
  // Optional client-only default, resolved lazily when there's no stored value
  // (e.g. deriving the storefront from the browser locale). The *server*
  // snapshot still returns `fallback`, so SSR/hydration stays stable — the
  // client just re-renders to this value after mount, like any stored read.
  clientDefault?: () => string,
): Store<string> {
  return makeStore<string>(
    () => {
      if (typeof window === "undefined") return fallback;
      let stored: string | null = null;
      try {
        stored = window.localStorage.getItem(key);
      } catch {
        return fallback;
      }
      if (stored) return stored;
      return clientDefault ? clientDefault() : fallback;
    },
    (next) => {
      try {
        window.localStorage.setItem(key, next);
      } catch {
        /* storage unavailable — ignore */
      }
    },
    fallback,
  );
}

export function makeJsonStore<T>(
  key: string,
  fallback: T,
  // Optional: shape the parsed blob into a T (e.g. drop retired keys or fill in
  // ones added since it was saved). Throwing here falls back like bad JSON does.
  normalize?: (saved: unknown) => T,
): Store<T> {
  return makeStore<T>(
    () => {
      if (typeof window === "undefined") return fallback;
      try {
        const raw = window.localStorage.getItem(key);
        if (!raw) return fallback;
        const saved: unknown = JSON.parse(raw);
        return normalize ? normalize(saved) : (saved as T);
      } catch {
        return fallback;
      }
    },
    (next) => {
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* storage unavailable — ignore */
      }
    },
    fallback,
  );
}

/** Per-tab boolean flag (sessionStorage). Server snapshot is `fallback`, so SSR
 *  never flips on a stored value; the client re-renders after mount. */
export function makeSessionFlagStore(key: string, fallback = false): Store<boolean> {
  return makeStore<boolean>(
    () => {
      if (typeof window === "undefined") return fallback;
      try {
        return window.sessionStorage.getItem(key) === "1";
      } catch {
        return fallback;
      }
    },
    (next) => {
      try {
        window.sessionStorage.setItem(key, next ? "1" : "0");
      } catch {
        /* storage unavailable — ignore */
      }
    },
    fallback,
  );
}
