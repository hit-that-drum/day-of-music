// /api/account — account lifecycle operations that can't run on the client.
//
// DELETE permanently removes the caller's account. Deleting a Supabase user
// requires the service_role key, which bypasses RLS and must NEVER be shipped
// to the browser — so it lives only here, in this server route. The FK
// `on delete cascade` on journal_entries/shared_cards removes their data with
// the user (see supabase/migrations/0001, 0006).

import { createClient } from "@supabase/supabase-js";

// Uses the service_role key + node-only APIs; keep it off the edge runtime.
export const runtime = "nodejs";

export async function DELETE(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) {
    return Response.json(
      { error: "Account deletion isn't configured on the server." },
      { status: 503 },
    );
  }

  const token = (request.headers.get("authorization") ?? "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  if (!token) return Response.json({ error: "Missing access token." }, { status: 401 });

  // Resolve the user FROM the token — never trust a client-supplied id. This
  // also validates that the session is genuine and unexpired.
  const asUser = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const {
    data: { user },
    error: authError,
  } = await asUser.auth.getUser();
  if (authError || !user) {
    return Response.json({ error: "Invalid or expired session." }, { status: 401 });
  }

  // Service-role client performs the actual deletion (cascades to app data).
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    return Response.json({ error: deleteError.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
