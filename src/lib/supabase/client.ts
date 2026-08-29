import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** How long any one supabase-js call may stay pending before we treat it as
 *  failed. Generous next to a healthy round trip; the point is only to put a
 *  ceiling on calls that never settle at all. */
export const AUTH_CALL_TIMEOUT_MS = 10_000;

/** Reject if `promise` hasn't settled within `ms`.
 *
 *  supabase-js serialises auth work behind a Web Lock. A lock that is acquired
 *  and never released doesn't produce an error — it produces a promise that
 *  stays pending, which is strictly worse: `try/catch` never fires, TanStack
 *  Query sits in `isPending` rather than `isError`, and every "handle the
 *  failure" path we have is skipped. Safari is where this actually shows up.
 *  Converting a hang into a rejection is what lets those paths run at all. */
// Takes a PromiseLike, not a Promise: supabase-js query builders are thenables
// that only become promises when awaited, and they need bounding just as much.
export function withTimeout<T>(promise: PromiseLike<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms (call never settled)`)),
      ms,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

/** True when the public Supabase env vars are present. When false the app runs
 *  in a single shared-journal mode with no sign-in gate. */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

let browserClient: SupabaseClient | null = null;

/** Singleton browser client (persists the session). Returns null when Supabase
 *  is not configured, so callers can fall back to the no-auth path. */
export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  browserClient ??= createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // PKCE (auth-code + verifier) instead of the implicit flow: OAuth and
        // email links return a short-lived `?code=`, exchanged for a session so
        // no access token is ever exposed in the URL hash. The code_verifier
        // lives in this browser's localStorage, so the exchange must complete in
        // the same browser that started it.
        flowType: "pkce",
        // Exchange the code explicitly in /auth/callback (not auto-detect), so a
        // cross-browser exchange that has no code_verifier surfaces as an error
        // we can turn into a "confirm succeeded — log in again" notice.
        detectSessionInUrl: false,
      },
    },
  );
  return browserClient;
}
