import { describe, expect, it } from "vitest";

import { formatDisplayDate } from "@/lib/day-of-music/data";

describe("formatDisplayDate", () => {
  it("writes the date the way the storefront's country does", () => {
    expect(formatDisplayDate("2023-04-04", "KR")).toBe("2023년 4월 4일");
    expect(formatDisplayDate("2023-04-04", "US")).toBe("April 4, 2023");
    expect(formatDisplayDate("2023-04-04", "JP")).toBe("2023年4月4日");
    expect(formatDisplayDate("2023-04-04", "US", "short")).toBe("Apr 4, 2023");
  });

  it("keeps the calendar day of an ISO timestamp, whatever the time zone", () => {
    expect(formatDisplayDate("2024-10-14T23:30:00Z", "US")).toBe("October 14, 2024");
  });

  it("gives the same answer from a reused formatter, and en-US without a country", () => {
    expect(formatDisplayDate(new Date(2026, 9, 24), "KR")).toBe("2026년 10월 24일");
    expect(formatDisplayDate(new Date(2026, 9, 24), "KR")).toBe("2026년 10월 24일");
    expect(formatDisplayDate("2026-10-24", undefined)).toBe("October 24, 2026");
  });

  it("is empty for missing or invalid input", () => {
    expect(formatDisplayDate("", "US")).toBe("");
    expect(formatDisplayDate(null, "US")).toBe("");
    expect(formatDisplayDate("not a date", "US")).toBe("");
  });
});
