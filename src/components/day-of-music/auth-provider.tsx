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
  signOut: () => Promise<void>;
  /** Set/change the signed-in user's password (no re-auth; session-based). */
  updatePassword: (password: string) => Promise<AuthResult>;
  /** Permanently delete the account + its data (server route, service role). */
  deleteAccount: () => Promise<AuthResult>;
  /** Merge keys into the account's user_metadata so profile prefs sync. */
  updateUserMetadata: (patch: Record<string, unknown>) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured();
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

  const signOut = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    await supabase.auth.signOut();
    setSession(null);
  }, []);

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
