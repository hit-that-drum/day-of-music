// top-bar.tsx — brand + screen navigation + log-album action.

import type { ScreenId } from "@/components/day-of-music/day-of-music-app";

const SCREENS: { id: ScreenId; label: string; ko: string }[] = [
  { id: "week", label: "Week", ko: "주간" },
  { id: "month", label: "Month", ko: "월간" },
  { id: "search", label: "Search", ko: "검색" },
  { id: "profile", label: "Profile", ko: "나의 기록" },
];

type Account = { email: string; onSignOut: () => void };

export function TopBar({
  screen,
  onScreen,
  onAdd,
  account = null,
}: {
  screen: ScreenId;
  onScreen: (id: ScreenId) => void;
  onAdd: () => void;
  account?: Account | null;
}) {
  return (
    <header className="dom-topbar">
      <div className="dom-brand">
        <span className="dom-brand-mark">●</span>
        <span className="dom-brand-name">Day of Music</span>
        <span className="dom-brand-ko">하루의 음악</span>
      </div>
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
        {account && (
          <span className="dom-account">
            <span className="dom-account-email" title={account.email}>
              {account.email}
            </span>
            <button className="dom-btn dom-btn-ghost" onClick={account.onSignOut}>
              Sign out
            </button>
          </span>
        )}
        <button className="dom-btn" onClick={onAdd}>
          ＋ Log album
        </button>
      </div>
    </header>
  );
}
