import { describe, expect, it } from "vitest";

import { todayInZone } from "@/lib/day-of-music/today";

describe("todayInZone", () => {
  // 15:30 UTC on Mar 1 is already Mar 2 in Seoul (UTC+9) and still Mar 1 in
  // New York (UTC-5, before DST starts on Mar 8).
  const now = new Date("2026-03-01T15:30:00Z");

  it("formats the calendar day in the given IANA zone", () => {
    expect(todayInZone("Asia/Seoul", now)).toBe("2026-03-02");
    expect(todayInZone("America/New_York", now)).toBe("2026-03-01");
    expect(todayInZone("UTC", now)).toBe("2026-03-01");
  });

  it("zero-pads and crosses year boundaries", () => {
    const newYearsEve = new Date("2025-12-31T20:00:00Z");
    expect(todayInZone("Asia/Seoul", newYearsEve)).toBe("2026-01-01");
    expect(todayInZone("America/Los_Angeles", newYearsEve)).toBe("2025-12-31");
  });

  it("falls back to the process zone for a missing, empty or unknown zone", () => {
    const own = todayInZone(Intl.DateTimeFormat().resolvedOptions().timeZone, now);
    expect(todayInZone(undefined, now)).toBe(own);
    expect(todayInZone("", now)).toBe(own);
    expect(todayInZone("Not/A_Zone", now)).toBe(own);
  });
});
