import { describe, expect, it } from "vitest";

import {
  DEFAULT_THEME,
  findTheme,
  formatThemeLabel,
  resolveActiveTheme,
  type Theme,
} from "@/lib/day-of-music/themes";

const themes: Theme[] = [
  { id: "daily", name: "Daily", emoji: "🎧" },
  { id: "drive", name: "Drive", emoji: "" },
];

describe("findTheme", () => {
  it("finds the theme for an id", () => {
    expect(findTheme(themes, "drive")).toBe(themes[1]);
  });

  it("falls back the way resolveActiveTheme does", () => {
    for (const id of ["daily", "drive", "deleted-lane"]) {
      expect(findTheme(themes, id).id).toBe(resolveActiveTheme(themes, id));
    }
    expect(findTheme([], "anything")).toEqual(DEFAULT_THEME);
  });
});

describe("formatThemeLabel", () => {
  it("prefixes the emoji, or shows just the name without one", () => {
    expect(formatThemeLabel(themes[0] ?? DEFAULT_THEME)).toBe("🎧 Daily");
    expect(formatThemeLabel(themes[1] ?? DEFAULT_THEME)).toBe("Drive");
  });
});
