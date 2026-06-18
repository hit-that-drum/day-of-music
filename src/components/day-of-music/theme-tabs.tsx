// theme-tabs.tsx — segmented switcher for the active themed lane.
// The calendar (week/month) reflects whichever theme is active here.

"use client";

import { resolveActiveTheme, useActiveTheme, useThemes } from "@/lib/day-of-music/themes";

export function ThemeTabs() {
  const { themes } = useThemes();
  const { activeTheme, setActiveTheme } = useActiveTheme();
  const active = resolveActiveTheme(themes, activeTheme);

  if (themes.length <= 1) return null;

  return (
    <div className="dom-theme-tabs" role="tablist" aria-label="Themes">
      {themes.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={t.id === active}
          className="dom-theme-tab"
          data-active={t.id === active ? "1" : "0"}
          onClick={() => setActiveTheme(t.id)}
        >
          <span className="dom-theme-tab-emoji" aria-hidden="true">
            {t.emoji}
          </span>
          {t.name}
        </button>
      ))}
    </div>
  );
}
