// theme-tabs.tsx — selector for the active themed lane.
// The calendar (week/month) reflects whichever theme is active here.

"use client";

import { DomSelectField } from "@/components/day-of-music/dom-select";
import { useT } from "@/lib/day-of-music/i18n";
import {
  formatThemeLabel,
  resolveActiveTheme,
  useActiveTheme,
  useThemes,
} from "@/lib/day-of-music/themes";

export function ThemeTabs() {
  const t = useT();
  const { themes } = useThemes();
  const { activeTheme, setActiveTheme } = useActiveTheme();
  const active = resolveActiveTheme(themes, activeTheme);
  const options = themes.map((theme) => ({
    value: theme.id,
    label: formatThemeLabel(theme),
  }));

  if (!themes.length) return null;

  return (
    <DomSelectField
      label={t("tweaks.theme")}
      className="dom-theme-select"
      value={active}
      options={options}
      onChange={setActiveTheme}
      variant="underline"
      size="large"
    />
  );
}
