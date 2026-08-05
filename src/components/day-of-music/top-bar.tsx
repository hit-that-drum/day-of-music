// top-bar.tsx — brand + screen navigation + header actions.

"use client";

import Link from "next/link";

import type { ScreenId } from "@/components/day-of-music/day-of-music-app";
import { BrandMark, Button, buttonClass } from "@/components/day-of-music/atoms";
import { LanguageSwitch } from "@/components/day-of-music/language-switch";
import { useT } from "@/lib/day-of-music/i18n";

// Each screen's label comes from the message dictionary (nav.*), rendered in
// the current language only.
const SCREENS: { id: ScreenId; key: string }[] = [
  { id: "week", key: "nav.week" },
  { id: "month", key: "nav.month" },
  { id: "search", key: "nav.journal" },
  { id: "logs", key: "nav.logs" },
  { id: "profile", key: "nav.profile" },
];

type Account = { email: string; onSignOut: () => void };

export function TopBar({
  screen,
  onScreen,
  onTweaks,
  account = null,
  showAuthLinks = false,
}: {
  screen: ScreenId;
  onScreen: (id: ScreenId) => void;
  /** Toggle the Tweaks panel (lives in the header now, not floating). */
  onTweaks: () => void;
  account?: Account | null;
  /** Show Sign in / Sign up links (guest mode). */
  showAuthLinks?: boolean;
}) {
  const t = useT();
  const tagline = t("brand.tagline");

  return (
    <header className="dom-topbar">
      <Link href="/" className="dom-brand">
        <BrandMark />
        <span className="dom-brand-name">Day of Music</span>
        {tagline && <span className="dom-brand-ko">{tagline}</span>}
      </Link>
      <nav className="dom-nav">
        {SCREENS.map((s) => (
          <button
            key={s.id}
            className="dom-nav-btn"
            data-active={screen === s.id ? "1" : "0"}
            onClick={() => onScreen(s.id)}
          >
            <span className="dom-nav-label">{t(s.key)}</span>
          </button>
        ))}
      </nav>
      <div className="dom-topbar-actions">
        <LanguageSwitch />
        <Button variant="ghost" data-dom-tweaks-trigger onClick={onTweaks}>
          {t("tweaks.title")}
        </Button>
        {account && (
          <Button variant="ghost" onClick={account.onSignOut}>
            {t("actions.signOut")}
          </Button>
        )}
        {showAuthLinks && (
          <>
            <Link href="/signin" className={buttonClass("ghost")}>
              {t("actions.signIn")}
            </Link>
            <Link href="/signup" className={buttonClass("ghost")}>
              {t("actions.signUp")}
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
