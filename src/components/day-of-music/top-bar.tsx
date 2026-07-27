// top-bar.tsx — brand + screen navigation + header actions.

import Link from "next/link";

import type { ScreenId } from "@/components/day-of-music/day-of-music-app";
import { BrandMark, Button, buttonClass } from "@/components/day-of-music/atoms";

const SCREENS: { id: ScreenId; label: string; ko: string }[] = [
  { id: "week", label: "Week", ko: "주간" },
  { id: "month", label: "Month", ko: "월간" },
  { id: "search", label: "Journal", ko: "저널" },
  { id: "logs", label: "My Logs", ko: "나의 기록" },
  { id: "profile", label: "Profile", ko: "프로필" },
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
  return (
    <header className="dom-topbar">
      <Link href="/" className="dom-brand">
        <BrandMark />
        <span className="dom-brand-name">Day of Music</span>
        <span className="dom-brand-ko">하루의 음악</span>
      </Link>
      <nav className="dom-nav">
        {SCREENS.map((s) => (
          <button
            key={s.id}
            className="dom-nav-btn"
            data-active={screen === s.id ? "1" : "0"}
            onClick={() => onScreen(s.id)}
          >
            <span className="dom-nav-label">{s.label}</span>
            <span className="dom-nav-ko">{s.ko}</span>
          </button>
        ))}
      </nav>
      <div className="dom-topbar-actions">
        <Button variant="ghost" data-dom-tweaks-trigger onClick={onTweaks}>
          Tweaks
        </Button>
        {account && (
          <Button variant="ghost" onClick={account.onSignOut}>
            Sign out
          </Button>
        )}
        {showAuthLinks && (
          <>
            <Link href="/signin" className={buttonClass("ghost")}>
              Sign in
            </Link>
            <Link href="/signup" className={buttonClass("ghost")}>
              Sign up
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
