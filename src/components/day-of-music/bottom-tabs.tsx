// bottom-tabs.tsx — the phone-only 5-tab bottom bar (≤760px).
// Rendered unconditionally as the last child of .dom-root and switched on by
// CSS alone (display:none on desktop), so the server markup never depends on
// the viewport. Labels reuse the header's nav.* keys via SCREENS.

"use client";

import {
  BookOpen,
  Calendar,
  CalendarRange,
  ChartColumn,
  CircleUser,
  type LucideIcon,
} from "lucide-react";

import type { ScreenId } from "@/components/day-of-music/day-of-music-app";
import { SCREENS } from "@/components/day-of-music/top-bar";
import { useT } from "@/lib/day-of-music/i18n";

const ICONS: Record<ScreenId, LucideIcon> = {
  week: CalendarRange,
  month: Calendar,
  search: BookOpen,
  logs: ChartColumn,
  profile: CircleUser,
};

export function BottomTabs({
  screen,
  onScreen,
}: {
  screen: ScreenId;
  onScreen: (id: ScreenId) => void;
}) {
  const t = useT();
  return (
    <nav className="dom-tabbar" aria-label={t("aria.tabbar")}>
      {SCREENS.map((s) => {
        const Icon = ICONS[s.id];
        const active = screen === s.id;
        return (
          <button
            key={s.id}
            type="button"
            className="dom-tab-btn"
            data-active={active ? "1" : "0"}
            aria-current={active ? "page" : undefined}
            onClick={() => {
              onScreen(s.id);
              window.scrollTo({ top: 0 }); // handler, not render — hydration-safe
            }}
          >
            <Icon
              size={20}
              strokeWidth={active ? 2.25 : 1.75}
              aria-hidden="true"
            />
            <span className="dom-tab-label">{t(s.key)}</span>
          </button>
        );
      })}
    </nav>
  );
}
