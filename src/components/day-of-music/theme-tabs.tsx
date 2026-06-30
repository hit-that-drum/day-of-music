// theme-tabs.tsx — selector for the active themed lane.
// The calendar (week/month) reflects whichever theme is active here.

"use client";

import { DomSelectField } from "@/components/day-of-music/dom-select";
import { resolveActiveTheme, useActiveTheme, useThemes } from "@/lib/day-of-music/themes";

export function ThemeTabs() {
  const { themes } = useThemes();
  const { activeTheme, setActiveTheme } = useActiveTheme();
  const active = resolveActiveTheme(themes, activeTheme);
  const options = themes.map((t) => ({
    value: t.id,
    label: t.emoji ? `${t.emoji} ${t.name}` : t.name,
  }));

  if (!themes.length) return null;

  return (
    <DomSelectField
      label="Theme"
      className="dom-theme-select"
      value={active}
      options={options}
      onChange={setActiveTheme}
      variant="underline"
      size="large"
    />
  );
}
