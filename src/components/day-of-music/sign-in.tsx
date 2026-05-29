// sign-in.tsx — sign-in gate shown when Supabase auth is configured and there is
// no active session. Magic-link (email OTP) + Google OAuth.

"use client";

import { useState } from "react";

import { useAuth } from "@/components/day-of-music/auth-provider";

export function SignIn() {
  const { signInWithOtp, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("sending");
    const { error } = await signInWithOtp(email.trim());
    if (error) {
      setStatus("error");
      setMessage(error);
    } else {
      setStatus("sent");
      setMessage(`Check ${email.trim()} for a sign-in link.`);
    }
  }

  return (
    <div className="dom-stage">
      <div className="dom-root" data-grid="1" data-rail="0" style={{ placeItems: "center" }}>
        <div className="dom-signin">
          <div className="dom-signin-brand">
            <span className="dom-brand-mark">●</span>
            <span className="dom-brand-name">Day of Music</span>
            <span className="dom-brand-ko">하루의 음악</span>
          </div>
          <div className="dom-signin-eyebrow">로그인 · sign in</div>
          <h1 className="dom-signin-title">Your year in listening</h1>
          <p className="dom-signin-sub">
            Log one album a day and build your journal. Sign in to keep it.
          </p>

          <form className="dom-signin-form" onSubmit={handleMagicLink}>
            <input
              className="dom-input"
              type="email"
              placeholder="you@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
            <button className="dom-btn" type="submit" disabled={status === "sending"}>
              {status === "sending" ? "Sending…" : "Email me a link"}
            </button>
          </form>

          <div className="dom-signin-or">or</div>
          <button className="dom-btn dom-btn-ghost" onClick={signInWithGoogle}>
            Continue with Google
          </button>

          {message && (
            <p className="dom-signin-msg" data-error={status === "error" ? "1" : "0"}>
              {message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
