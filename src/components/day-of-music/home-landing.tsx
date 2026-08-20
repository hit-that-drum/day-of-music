// home-landing.tsx — public landing page at "/".
// Everyone (guest or signed-in) can see this and jump into the Week board.

"use client";

import { Fragment, useEffect, useRef } from "react";
import Link from "next/link";

import type { Album } from "@/lib/day-of-music/data";
import { applyTheme, ensureFonts } from "@/lib/day-of-music/theme";
import { useT } from "@/lib/day-of-music/i18n";
import { useAuth } from "@/components/day-of-music/auth-provider";
import { BrandMark } from "@/components/day-of-music/atoms";
import { Button, buttonClass } from "@/components/day-of-music/atoms";
import { Cover } from "@/components/day-of-music/cover";

// Self-contained decorative covers for the hero — purely typographic tiles,
// not real albums. (The seed catalog is intentionally empty; albums now come
// only from iTunes search.)
const HERO_COVERS: Album[] = (
  [
    {
      style: "stack",
      bg: "#b9a3d9",
      fg: "#1a1430",
      accent: "#f6e6ff",
      title: "side a",
    },
    {
      style: "ring",
      bg: "#10243a",
      fg: "#dce9f5",
      accent: "#5fa8d3",
      title: "nocturne",
    },
    {
      style: "split",
      bg: "#1d1a18",
      fg: "#f4d35e",
      accent: "#c75146",
      title: "reprise",
    },
    {
      style: "block",
      bg: "#222a22",
      fg: "#d9e8d4",
      accent: "#8aa86e",
      title: "encore",
    },
  ] as const
).map((t, i) => ({
  id: `hero-${i}`,
  date: "",
  title: t.title,
  titleKo: "",
  artist: "Day of Music",
  genre: "",
  year: 0,
  format: "",
  cover: { style: t.style, bg: t.bg, fg: t.fg, accent: t.accent },
  note: "",
  rating: 0,
  tracks: [],
}));

const REPORT_EMAIL_HREF = `mailto:dayofmusic365@gmail.com?subject=${encodeURIComponent(
  "[Day of Music] 문제 신고 및 개선 의견",
)}&body=${encodeURIComponent(
  "이용 중 불편했던 점이나 개선 의견을 자유롭게 적어주세요.\n\n내용:\n\n사용 환경(선택):\n",
)}`;

export function HomeLanding() {
  const rootRef = useRef<HTMLDivElement>(null);
  const { configured, user, signOut } = useAuth();
  const t = useT();

  useEffect(() => {
    ensureFonts();
    applyTheme(rootRef.current, "editorial", "editorial");
  }, []);

  return (
    <div className="dom-stage" ref={rootRef}>
      <div className="dom-root" data-grid="1">
        <header className="dom-topbar">
          <div className="dom-brand">
            <BrandMark />
            <span className="dom-brand-name">Day of Music</span>
            <span className="dom-brand-ko">{t("brand.tagline")}</span>
          </div>
          <div className="dom-topbar-actions">
            {configured && user ? (
              <span className="dom-account">
                <span className="dom-account-email" title={user.email ?? ""}>
                  {user.email}
                </span>
                <Button variant="ghost" onClick={signOut}>
                  {t("actions.signOut")}
                </Button>
              </span>
            ) : (
              <>
                <Link href="/signin" className={buttonClass("ghost")}>
                  {t("actions.signIn")}
                </Link>
                <Link href="/signup" className={buttonClass()}>
                  {t("actions.signUp")}
                </Link>
              </>
            )}
          </div>
        </header>

        <main
          className="dom-main"
          style={{ display: "grid", placeItems: "center" }}
        >
          <div className="dom-home-hero">
            <div className="dom-signin-eyebrow">{t("home.eyebrow")}</div>
            <h1 className="dom-home-title">
              {t("home.title")
                .split("\n")
                .map((line, i) => (
                  <Fragment key={i}>
                    {i > 0 && <br />}
                    {line}
                  </Fragment>
                ))}
            </h1>
            <p className="dom-home-sub">{t("home.sub")}</p>

            {/* Fluid tiles, so the phone's two-column grid fills the row
                instead of leaving a gutter beside two fixed 120px covers.
                .dom-home-covers caps the row so they still land on 120px at
                the hero's full width. */}
            <div className="dom-home-covers">
              {HERO_COVERS.map((a) => (
                <Cover key={a.id} album={a} size="100%" />
              ))}
            </div>

            <div className="dom-home-actions">
              <Link href="/week" className={buttonClass("solid", "lg")}>
                {t("home.openBoard")} →
              </Link>
              {!user && (
                <Link href="/signup" className={buttonClass("ghost")}>
                  {t("home.createAccount")}
                </Link>
              )}
            </div>
            {!user && <p className="dom-home-note">{t("home.note")}</p>}
          </div>
        </main>

        <footer className="dom-home-footer">
          <span>© {new Date().getFullYear()} Day of Music</span>
          <nav className="dom-home-legal" aria-label={t("home.legalAria")}>
            <Link href="/terms">{t("legal.termsLink")}</Link>
            <Link href="/privacy">{t("legal.privacyLink")}</Link>
            <a
              href={REPORT_EMAIL_HREF}
              aria-label={t("home.reportAria")}
              title={t("home.reportTitle")}
            >
              {t("home.report")}
            </a>
          </nav>
        </footer>
      </div>
    </div>
  );
}
