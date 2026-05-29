// server.ts — server-side Supabase helpers for validating bearer tokens.
// We use the anon client + auth.getUser(token) rather than @supabase/ssr cookies,
// since the journal API is called from the client with an Authorization header.

import { createClient } from "@supabase/supabase-js";

export function isSupabaseServerConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

/** Resolve the authenticated user id from a request's Bearer token.
 *  Returns null when there is no valid token (or Supabase isn't configured). */
export async function getUserIdFromRequest(request: Request): Promise<string | null> {
  if (!isSupabaseServerConfigured()) return null;

  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;
  if (!token) return null;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}
