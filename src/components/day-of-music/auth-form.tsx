// auth-form.tsx — shared email+password form for /signin and /signup,
// with Google OAuth. Reuses the dom-signin styles from the original gate.

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/day-of-music/auth-provider";
import { Button } from "@/components/day-of-music/atoms";

type Mode = "signin" | "signup";

const COPY: Record<
  Mode,
  { eyebrow: string; title: string; sub: string; cta: string; altText: string; altCta: string; altHref: string }
> = {
  signin: {
    eyebrow: "로그인 · sign in",
    title: "Welcome back",
    sub: "Sign in to keep your journal across devices.",
    cta: "Sign in",
    altText: "New here?",
    altCta: "Create an account",
    altHref: "/signup",
  },
  signup: {
    eyebrow: "가입 · sign up",
    title: "Start your journal",
    sub: "One album a day. Your year in listening, saved to your account.",
    cta: "Create account",
    altText: "Already have an account?",
    altCta: "Sign in",
    altHref: "/signin",
  },
};

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const { configured, signInWithPassword, signUpWithPassword, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "busy" | "error" | "sent">("idle");
  const [message, setMessage] = useState("");

  const copy = COPY[mode];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setStatus("busy");
    setMessage("");

    const action = mode === "signin" ? signInWithPassword : signUpWithPassword;
    const { error } = await action(email.trim(), password);

    if (error) {
      setStatus("error");
      setMessage(error);
      return;
    }
    if (mode === "signup") {
      // Depending on project settings, Supabase may require email confirmation.
      setStatus("sent");
      setMessage(`Account created. If ${email.trim()} needs confirmation, check your inbox.`);
      return;
    }
    router.push("/week");
  }

  return (
    <div className="dom-stage">
      <div className="dom-root" data-grid="1" style={{ placeItems: "center" }}>
        <div className="dom-signin">
          <Link href="/" className="dom-signin-brand">
            <span className="dom-brand-mark">●</span>
            <span className="dom-brand-name">Day of Music</span>
            <span className="dom-brand-ko">하루의 음악</span>
          </Link>
          <div className="dom-signin-eyebrow">{copy.eyebrow}</div>
          <h1 className="dom-signin-title">{copy.title}</h1>
          <p className="dom-signin-sub">{copy.sub}</p>

          {!configured && (
            <p className="dom-signin-msg" data-error="1">
              Auth isn&apos;t configured yet — add Supabase keys to .env.local. You can
              still <Link href="/week">use the app as a guest</Link>.
            </p>
          )}

          <form className="dom-signin-form" onSubmit={handleSubmit}>
            <input
              className="dom-input"
              type="email"
              placeholder="you@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
            <input
              className="dom-input"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              minLength={6}
              required
            />
            <Button type="submit" disabled={!configured || status === "busy"}>
              {status === "busy" ? "One moment…" : copy.cta}
            </Button>
          </form>

          <div className="dom-signin-or">or</div>
          <Button variant="ghost" onClick={signInWithGoogle} disabled={!configured}>
            Continue with Google
          </Button>

          {message && (
            <p className="dom-signin-msg" data-error={status === "error" ? "1" : "0"}>
              {message}
            </p>
          )}

          <p className="dom-signin-sub" style={{ marginTop: 16 }}>
            {copy.altText} <Link href={copy.altHref}>{copy.altCta}</Link>
            {" · "}
            <Link href="/week">Continue as guest</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
