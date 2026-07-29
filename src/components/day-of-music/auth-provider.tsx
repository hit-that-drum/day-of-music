// auth-provider.tsx — Supabase auth context for Day of Music.
// When Supabase isn't configured, `configured` is false and the app runs as a
// single shared journal with no sign-in gate.

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Session, User } from "@supabase/supabase-js";

import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

type AuthResult = { error: string | null };

type AuthContextValue = {
  configured: boolean;
  loading: boolean;
  user: User | null;
  accessToken: string | null;
  signUpWithPassword: (email: string, password: string) => Promise<AuthResult>;
  signInWithPassword: (email: string, password: string) => Promise<AuthResult>;
  signInWithGoogle: () => Promise<void>;
  signInWithKakao: () => Promise<void>;
  signOut: () => Promise<void>;
  /** Set/change the signed-in user's password (no re-auth; session-based). */
  updatePassword: (password: string) => Promise<AuthResult>;
  /** Permanently delete the account + its data (server route, service role). */
  deleteAccount: () => Promise<AuthResult>;
  /** Merge keys into the account's user_metadata so profile prefs sync. */
  updateUserMetadata: (patch: Record<string, unknown>) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

// --- Idle auto-logout -------------------------------------------------------
// Sign the user out after IDLE_TIMEOUT_MS with no API activity. "Activity" is
// any fetch to our own API or Supabase's data layer; Supabase's /auth/v1/
// traffic (background token refresh + session reads) is deliberately EXCLUDED
// so an idle-but-open tab actually times out instead of being kept alive
// forever by the autoRefreshToken heartbeat. The last-activity timestamp is
// mirrored to localStorage so activity in one tab keeps the others alive.
const IDLE_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour of no API calls → sign out
const IDLE_CHECK_MS = 60 * 1000; // how often we re-evaluate the idle window
const IDLE_PERSIST_THROTTLE_MS = 15 * 1000; // cap the localStorage write rate
const IDLE_STORAGE_KEY = "dom:last-activity";

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(configured);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    // When unconfigured, `loading` already starts false — nothing to wait for.
    if (!supabase) return;

    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signUpWithPassword = useCallback(async (email: string, password: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return { error: "Supabase is not configured." };
    const { error } = await supabase.auth.signUp({
      email,
      password,
      // Confirmation link returns through /auth/callback, which exchanges the
      // PKCE code for a session (and handles cross-device opens gracefully).
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    return { error: error?.message ?? null };
  }, []);

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return { error: "Supabase is not configured." };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    // Google redirects back to /auth/callback, which exchanges the PKCE code
    // for a session before sending the user on to /week.
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }, []);

  const signInWithKakao = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    // Same flow as Google — Kakao redirects back to /auth/callback, which
    // exchanges the PKCE code for a session before sending the user to /week.
    await supabase.auth.signInWithOAuth({
      provider: "kakao",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }, []);

  const signOut = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    await supabase.auth.signOut();
    setSession(null);
    // Send the user back to the sign-in page (mirrors /auth/callback's use of
    // router.replace so the signed-out state isn't left in history).
    router.replace("/signin");
  }, [router]);

  // Auto sign-out after an hour of no API activity. Gated on a stable boolean
  // (not `session`) so a background token refresh — which swaps in a new session
  // object hourly — does NOT tear down and restart the timer.
  const signedIn = configured && Boolean(session);
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
        toast("장시간 활동이 없어 자동 로그아웃되었어요.");
        void signOut();
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
  }, [signedIn, signOut]);

  const updatePassword = useCallback(async (password: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return { error: "Supabase is not configured." };
    // Session-based: GoTrue changes the password for the currently signed-in
    // user. For OAuth-only accounts this sets a password for the first time.
    const { error } = await supabase.auth.updateUser({ password });
    return { error: error?.message ?? null };
  }, []);

  const deleteAccount = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return { error: "Supabase is not configured." };
    // Deleting a user needs the service_role key, which must never reach the
    // client — so hand off to the server route with our access token. The
    // route verifies the token, then deletes the account (FK cascade wipes the
    // journal/share rows).
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return { error: "You're not signed in." };
    const res = await fetch("/api/account", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      return { error: body?.error ?? "Account deletion failed." };
    }
    await supabase.auth.signOut();
    setSession(null);
    return { error: null };
  }, []);

  const updateUserMetadata = useCallback(async (patch: Record<string, unknown>) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    // GoTrue merges these keys into user_metadata.
    const { data, error } = await supabase.auth.updateUser({ data: patch });
    // Reflect the new metadata immediately (onAuthStateChange also fires).
    if (!error && data.user) setSession((s) => (s ? { ...s, user: data.user } : s));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      configured,
      loading,
      user: session?.user ?? null,
      accessToken: session?.access_token ?? null,
      signUpWithPassword,
      signInWithPassword,
      signInWithGoogle,
      signInWithKakao,
      signOut,
      updatePassword,
      deleteAccount,
      updateUserMetadata,
    }),
    [
      configured,
      loading,
      session,
      signUpWithPassword,
      signInWithPassword,
      signInWithGoogle,
      signInWithKakao,
      signOut,
      updatePassword,
      deleteAccount,
      updateUserMetadata,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
