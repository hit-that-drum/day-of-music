// top-bar.tsx — brand + screen navigation + header actions.

"use client";

import Link from "next/link";
import { Ellipsis, SlidersHorizontal } from "lucide-react";

import { BrandMark, Button, IconButton, buttonClass } from "@/components/day-of-music/atoms";
import { LanguageSwitch } from "@/components/day-of-music/language-switch";
import { useT } from "@/lib/day-of-music/i18n";
import type { MessageKey } from "@/lib/day-of-music/messages";

// The app's screens, in nav order. Each label comes from the message
// dictionary (nav.*), rendered in the current language only. Exported so the
// phone tab bar and the app shell share the list.
export const SCREENS = [
  { id: "week", key: "nav.week" },
  { id: "month", key: "nav.month" },
  { id: "search", key: "nav.journal" },
  { id: "logs", key: "nav.logs" },
  { id: "profile", key: "nav.profile" },
] as const satisfies readonly { id: string; key: MessageKey }[];

export type ScreenId = (typeof SCREENS)[number]["id"];

/** The signed-in account as the header and the phone More sheet show it. */
export type Account = { email: string; onSignOut: () => void };

export function TopBar({
  screen,
  onScreen,
  onTweaks,
  onMore,
  account = null,
  showAuthLinks = false,
}: {
  screen: ScreenId;
  onScreen: (id: ScreenId) => void;
  /** Toggle the Tweaks panel (lives in the header now, not floating). */
  onTweaks: () => void;
  /** Open the phone overflow sheet (language / account / legal). */
  onMore: () => void;
  account?: Account | null;
  /** Show Sign in / Sign up links (guest mode). */
  showAuthLinks?: boolean;
}) {
  const t = useT();
  const tagline = t("brand.tagline");

  return (
    <header className="dom-topbar dom-topbar-app">
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
            aria-current={screen === s.id ? "page" : undefined}
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
      {/* Phone-only header icons (display:none on desktop). */}
      <div className="dom-topbar-m">
        <IconButton
          icon={SlidersHorizontal}
          iconSize={20}
          data-dom-tweaks-trigger
          onClick={onTweaks}
          aria-label={t("tweaks.title")}
        />
        <IconButton
          icon={Ellipsis}
          iconSize={20}
          onClick={onMore}
          aria-haspopup="dialog"
          aria-label={t("menu.title")}
        />
      </div>
    </header>
  );
}
