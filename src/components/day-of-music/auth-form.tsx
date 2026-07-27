// auth-form.tsx — shared email+password form for /signin and /signup,
// with Google OAuth. Reuses the dom-signin styles from the original gate.

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/day-of-music/auth-provider";
import { BrandMark, Button } from "@/components/day-of-music/atoms";
import { PASSWORD_RULES, passwordIssues } from "@/lib/day-of-music/password";

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
  // Block submit until signup passwords satisfy the policy. Signin stays open.
  const signupInvalid = mode === "signup" && passwordIssues(password).length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    // Enforce the password policy on signup only, so existing accounts aren't
    // locked out at sign-in. The checklist below already shows what's missing.
    if (mode === "signup" && passwordIssues(password).length > 0) {
      setStatus("error");
      setMessage("Please meet the password requirements below.");
      return;
    }
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
            <BrandMark />
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
              minLength={mode === "signup" ? 8 : undefined}
              aria-describedby={mode === "signup" ? "dom-pw-rules" : undefined}
              required
            />
            {mode === "signup" && (
              <ul className="dom-pw-rules" id="dom-pw-rules" aria-label="Password requirements">
                {PASSWORD_RULES.map((rule) => {
                  const met = rule.test(password);
                  return (
                    <li key={rule.id} className="dom-pw-rule" data-met={met ? "1" : "0"}>
                      <span className="dom-pw-rule-mark" aria-hidden="true">
                        {met ? "✓" : "○"}
                      </span>
                      <span>{rule.label}</span>
                      <span className="dom-visually-hidden">{met ? " (met)" : " (not met)"}</span>
                    </li>
                  );
                })}
              </ul>
            )}
            <Button type="submit" disabled={!configured || status === "busy" || signupInvalid}>
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
