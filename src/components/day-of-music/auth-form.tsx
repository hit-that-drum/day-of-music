// auth-form.tsx — shared email+password form for /signin and /signup,
// with Google OAuth. Reuses the dom-signin styles from the original gate.

"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/day-of-music/auth-provider";
import { BrandMark, Button } from "@/components/day-of-music/atoms";
import { PASSWORD_RULES, passwordIssues } from "@/lib/day-of-music/password";
import { useT } from "@/lib/day-of-music/i18n";
import { GoogleIcon, KakaoIcon } from "@/components/day-of-music/brand-icons";

type Mode = "signin" | "signup";

// Render a translated string with `{token}` placeholders replaced by <Link>s,
// so link position follows each language's word order (see the terms notice).
function renderWithLinks(
  template: string,
  links: Record<string, { href: string; label: string }>,
): React.ReactNode[] {
  return template.split(/(\{\w+\})/).map((part, i) => {
    const token = part.match(/^\{(\w+)\}$/)?.[1];
    const link = token ? links[token] : undefined;
    return link ? (
      <Link key={i} href={link.href}>
        {link.label}
      </Link>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    );
  });
}

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const {
    configured,
    signInWithPassword,
    signUpWithPassword,
    signInWithGoogle,
    signInWithKakao,
  } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "busy" | "error" | "sent">(
    "idle",
  );
  const [message, setMessage] = useState("");
  const t = useT();

  const altHref = mode === "signin" ? "/signup" : "/signin";
  const copy = {
    eyebrow: t(`auth.${mode}.eyebrow`),
    title: t(`auth.${mode}.title`),
    sub: t(`auth.${mode}.sub`),
    cta: t(`auth.${mode}.cta`),
    altText: t(`auth.${mode}.altText`),
    altCta: t(`auth.${mode}.altCta`),
  };
  // Block submit until signup passwords satisfy the policy. Signin stays open.
  const signupInvalid =
    mode === "signup" && passwordIssues(password).length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    // Enforce the password policy on signup only, so existing accounts aren't
    // locked out at sign-in. The checklist below already shows what's missing.
    if (mode === "signup" && passwordIssues(password).length > 0) {
      setStatus("error");
      setMessage(t("auth.pwRequirements"));
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
      setMessage(t("auth.accountCreated", { email: email.trim() }));
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
              Auth isn&apos;t configured yet — add Supabase keys to .env.local.
              You can still <Link href="/week">use the app as a guest</Link>.
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
              placeholder={t("auth.passwordPlaceholder")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={
                mode === "signup" ? "new-password" : "current-password"
              }
              minLength={mode === "signup" ? 8 : undefined}
              aria-describedby={mode === "signup" ? "dom-pw-rules" : undefined}
              required
            />
            {mode === "signup" && (
              <ul
                className="dom-pw-rules"
                id="dom-pw-rules"
                aria-label={t("auth.pwRulesAria")}
              >
                {PASSWORD_RULES.map((rule) => {
                  const met = rule.test(password);
                  return (
                    <li
                      key={rule.id}
                      className="dom-pw-rule"
                      data-met={met ? "1" : "0"}
                    >
                      <span className="dom-pw-rule-mark" aria-hidden="true">
                        {met ? "✓" : "○"}
                      </span>
                      <span>{t(`pw.${rule.id}`)}</span>
                      <span className="dom-visually-hidden">
                        {met ? ` ${t("auth.met")}` : ` ${t("auth.notMet")}`}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            <Button
              type="submit"
              disabled={!configured || status === "busy" || signupInvalid}
            >
              {status === "busy" ? t("auth.oneMoment") : copy.cta}
            </Button>
          </form>

          <div className="dom-signin-or">{t("auth.or")}</div>
          <Button
            className="dom-btn-with-icon"
            variant="ghost"
            onClick={signInWithGoogle}
            disabled={!configured}
          >
            <GoogleIcon />
            {t("auth.google")}
          </Button>
          <Button
            className="dom-btn-with-icon"
            variant="ghost"
            onClick={signInWithKakao}
            disabled={!configured}
          >
            <KakaoIcon />
            {t("auth.kakao")}
          </Button>

          {mode === "signup" && (
            <p className="dom-auth-terms">
              {renderWithLinks(t("auth.terms"), {
                terms: { href: "/terms", label: t("legal.termsLink") },
                privacy: { href: "/privacy", label: t("legal.privacyLink") },
              })}
            </p>
          )}

          {message && (
            <p
              className="dom-signin-msg"
              data-error={status === "error" ? "1" : "0"}
            >
              {message}
            </p>
          )}

          <p className="dom-signin-sub" style={{ marginTop: 16 }}>
            {copy.altText} <Link href={altHref}>{copy.altCta}</Link>
            {" · "}
            <Link href="/week">{t("auth.guestContinue")}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
