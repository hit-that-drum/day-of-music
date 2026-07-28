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

// Brand marks for the OAuth buttons. Official sign-in glyphs, decorative
// (aria-hidden) since each button already has a visible text label.
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z" />
      <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z" />
      <path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z" />
      <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z" />
    </svg>
  );
}

function KakaoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#000000"
        d="M12 3C6.477 3 2 6.463 2 10.735c0 2.764 1.874 5.19 4.686 6.559-.155.534-.998 3.44-1.03 3.66 0 0-.02.174.093.24.113.067.245.015.245.015.32-.045 3.712-2.43 4.297-2.842.552.08 1.12.122 1.709.122 5.523 0 10-3.463 10-7.735S17.523 3 12 3z"
      />
    </svg>
  );
}

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
  const { configured, signInWithPassword, signUpWithPassword, signInWithGoogle, signInWithKakao } =
    useAuth();
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
          <Button
            className="dom-btn-with-icon"
            variant="ghost"
            onClick={signInWithGoogle}
            disabled={!configured}
          >
            <GoogleIcon />
            Continue with Google
          </Button>
          <Button
            className="dom-btn-with-icon"
            variant="ghost"
            onClick={signInWithKakao}
            disabled={!configured}
          >
            <KakaoIcon />
            Continue with Kakao
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
