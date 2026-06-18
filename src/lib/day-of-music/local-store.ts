// local-store.ts — tiny localStorage-backed stores read via useSyncExternalStore
// so values survive reloads without a hydration mismatch. `makeStringStore`
// holds a raw string; `makeJsonStore` (de)serializes any JSON-able value. Both
// fall back to a default on the server and when storage is unavailable.

type Store<T> = {
  getSnapshot: () => T;
  getServerSnapshot: () => T;
  subscribe: (cb: () => void) => () => void;
  set: (next: T) => void;
};

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

export function makeStringStore(key: string, fallback: string): Store<string> {
  return makeStore<string>(
    () => {
      if (typeof window === "undefined") return fallback;
      try {
        return window.localStorage.getItem(key) || fallback;
      } catch {
        return fallback;
      }
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

export function makeJsonStore<T>(key: string, fallback: T): Store<T> {
  return makeStore<T>(
    () => {
      if (typeof window === "undefined") return fallback;
      try {
        const raw = window.localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as T) : fallback;
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
