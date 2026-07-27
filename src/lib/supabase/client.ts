import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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
