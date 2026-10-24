import { describe, expect, it } from "vitest";

import {
  dateTimeLong,
  effectiveLocale,
  monthDayShort,
  translate,
  weekdayRowMonFirst,
} from "@/lib/day-of-music/i18n-core";

describe("translate", () => {
  it("fills {name} tokens and leaves unknown ones untouched", () => {
    expect(translate("en", "toast.logged", { title: "Blue" })).toBe("Logged Blue");
    expect(translate("ko", "toast.logged", { title: "Blue" })).toBe("Blue 기록됨");
    // No params: the template comes back as-is (profile-page splits on {email}).
    expect(translate("en", "profile.delete.typeEmail")).toBe("Type {email} to confirm.");
  });
});

describe("effectiveLocale", () => {
  it("follows the storefront on auto, and an explicit language otherwise", () => {
    expect(effectiveLocale("auto", "KR")).toBe("ko");
    expect(effectiveLocale("auto", "MX")).toBe("es");
    expect(effectiveLocale("auto", "DE")).toBe("en");
    expect(effectiveLocale("ja", "KR")).toBe("ja");
  });
});

describe("date formatting", () => {
  const date = new Date(2026, 9, 24, 8, 5);

  it("formats date+time and date-only from separate cached formatters", () => {
    const day = monthDayShort("en", date);
    const full = dateTimeLong("en", date);
    expect(day).toBe("Oct 24");
    expect(full).toMatch(/October 24, 2026/);
    expect(full).toMatch(/08:05/);
    // Cached formatters come back unchanged on a second call.
    expect(monthDayShort("en", date)).toBe(day);
    expect(dateTimeLong("en", date)).toBe(full);
  });

  it("follows the UI locale", () => {
    expect(dateTimeLong("ko", date)).toMatch(/2026년 10월 24일/);
    expect(weekdayRowMonFirst("en")).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
  });
});
