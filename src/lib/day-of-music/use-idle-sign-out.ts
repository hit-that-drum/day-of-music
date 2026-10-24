// use-idle-sign-out.ts — the idle auto-logout behind AuthProvider.
// Sign the user out after IDLE_TIMEOUT_MS with no API activity. "Activity" is
// any fetch to our own API or Supabase's data layer; Supabase's /auth/v1/
// traffic (background token refresh + session reads) is deliberately EXCLUDED
// so an idle-but-open tab actually times out instead of being kept alive
// forever by the autoRefreshToken heartbeat. The last-activity timestamp is
// mirrored to localStorage so activity in one tab keeps the others alive.

import { useEffect, useEffectEvent } from "react";

const IDLE_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour of no API calls → sign out
const IDLE_CHECK_MS = 60 * 1000; // how often we re-evaluate the idle window
const IDLE_PERSIST_THROTTLE_MS = 15 * 1000; // cap the localStorage write rate
const IDLE_STORAGE_KEY = "dom:last-activity";

/** While `signedIn`, call `onIdle` once the idle window passes with no API
 *  activity in any tab. Pass a stable boolean, not the session: a background
 *  token refresh swaps in a new session object hourly, and restarting here
 *  would reset the window. `onIdle` may change identity freely. */
export function useIdleSignOut(signedIn: boolean, onIdle: () => void): void {
  const fireIdle = useEffectEvent(onIdle);

  useEffect(() => {
    if (!signedIn) return;

    const readStored = (): number => {
      try {
        return Number(window.localStorage.getItem(IDLE_STORAGE_KEY)) || 0;
      } catch {
        return 0; // storage blocked (private mode) → fall back to in-memory
      }
    };
    const writeStored = (ts: number) => {
      try {
        window.localStorage.setItem(IDLE_STORAGE_KEY, String(ts));
      } catch {
        /* storage unavailable — in-memory tracking still works for this tab */
      }
    };

    // Opening/reloading the app is itself activity, so start a fresh window.
    let lastActivity = Date.now();
    let lastPersist = 0;
    let triggered = false;
    writeStored(lastActivity);

    const markActive = () => {
      lastActivity = Date.now();
      if (lastActivity - lastPersist >= IDLE_PERSIST_THROTTLE_MS) {
        lastPersist = lastActivity;
        writeStored(lastActivity);
      }
    };

    // supabase-js resolves globalThis.fetch at call time, so patching
    // window.fetch catches its DB queries too — not just our /api/* fetches.
    const originalFetch = window.fetch;
    window.fetch = (...args: Parameters<typeof fetch>) => {
      const input = args[0];
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input instanceof Request
              ? input.url
              : "";
      // Exclude auth traffic (token refresh/session reads) — that's the app
      // keeping itself alive, not the user doing something.
      if (!url.includes("/auth/v1/")) markActive();
      return originalFetch.apply(window, args);
    };

    const evaluate = () => {
      if (triggered) return;
      // Newest activity across any open tab keeps this session alive.
      const last = Math.max(lastActivity, readStored());
      if (Date.now() - last >= IDLE_TIMEOUT_MS) {
        triggered = true;
        fireIdle();
      }
    };

    const interval = window.setInterval(evaluate, IDLE_CHECK_MS);
    // A backgrounded/suspended tab misses interval ticks — re-check on return.
    const onVisible = () => {
      if (document.visibilityState === "visible") evaluate();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.fetch = originalFetch;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [signedIn]);
}
