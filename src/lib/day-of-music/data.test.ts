import dayjs from "dayjs";
import { describe, expect, it } from "vitest";

import {
  addDays,
  adjacentDates,
  fmtDate,
  formatDisplayDate,
  isSameMonth,
  monthEnd,
  monthGrid,
  monthStart,
  segmentDays,
  startOfWeek,
  weekDays,
} from "@/lib/day-of-music/data";

describe("adjacentDates", () => {
  // Logged days, unsorted, with gaps and a month boundary.
  const logged = ["2026-10-24", "2026-10-20", "2026-11-02", "2026-10-21", "2026-09-30"];

  it("finds the nearest logged day on each side, skipping empty days", () => {
    expect(adjacentDates(logged, "2026-10-21")).toEqual({ prev: "2026-10-20", next: "2026-10-24" });
    expect(adjacentDates(logged, "2026-10-24")).toEqual({ prev: "2026-10-21", next: "2026-11-02" });
  });

  it("crosses week and month boundaries", () => {
    expect(adjacentDates(logged, "2026-10-20")).toEqual({ prev: "2026-09-30", next: "2026-10-21" });
  });

  it("is null past the first and last logged day", () => {
    expect(adjacentDates(logged, "2026-09-30").prev).toBeNull();
    expect(adjacentDates(logged, "2026-11-02").next).toBeNull();
    expect(adjacentDates([], "2026-10-21")).toEqual({ prev: null, next: null });
  });

  it("works from a day that isn't logged itself", () => {
    expect(adjacentDates(logged, "2026-10-22")).toEqual({ prev: "2026-10-21", next: "2026-10-24" });
  });
});

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

// Every month of 2024–2027: leap and common Februaries, months starting on each
// weekday, and the DST changeovers.
const MONTHS = Array.from({ length: 48 }, (_, i) => new Date(2024, i, 15));

describe("monthGrid", () => {
  it("matches the formula the views used before it, for every month 2024–2027", () => {
    for (const anchor of MONTHS) {
      // The views' own computation, kept here as the reference.
      const current = dayjs(anchor);
      const calStart = startOfWeek(current.startOf("month").toDate());
      const numWeeks = Math.ceil((current.endOf("month").diff(dayjs(calStart), "day") + 1) / 7);
      const days = Array.from({ length: numWeeks * 7 }, (_, i) => addDays(calStart, i));

      const grid = monthGrid(anchor);
      expect(grid.numWeeks).toBe(numWeeks);
      expect(grid.days.map(fmtDate)).toEqual(days.map(fmtDate));
    }
  });

  it("starts on a Monday and covers the whole month", () => {
    for (const anchor of MONTHS) {
      const { days } = monthGrid(anchor);
      expect(days[0].getDay()).toBe(1);
      expect(days[0] <= monthStart(anchor)).toBe(true);
      expect(fmtDate(days[days.length - 1]) >= fmtDate(monthEnd(anchor))).toBe(true);
    }
    // February 2027 starts on a Monday and fits four rows exactly.
    expect(monthGrid(new Date(2027, 1, 10)).numWeeks).toBe(4);
  });
});

describe("week strips", () => {
  // Mon 2026-06-29 … Sun 2026-07-05, straddling June and July.
  const week = weekDays(new Date(2026, 5, 29));

  it("lays out Mon–Sun from the week's start", () => {
    expect(week.map(fmtDate)).toEqual([
      "2026-06-29", "2026-06-30", "2026-07-01", "2026-07-02", "2026-07-03", "2026-07-04", "2026-07-05",
    ]);
  });

  it("keeps the whole week, or only the label month's days when split", () => {
    expect(segmentDays(week, new Date(2026, 5, 29), false)).toBe(week);
    expect(segmentDays(week, new Date(2026, 6, 1), true).map(fmtDate)).toEqual([
      "2026-07-01", "2026-07-02", "2026-07-03", "2026-07-04", "2026-07-05",
    ]);
    expect(segmentDays(week, new Date(2026, 5, 29), true)).toHaveLength(2);
  });

  it("compares months by year too", () => {
    expect(isSameMonth("2026-07-31", new Date(2026, 6, 1))).toBe(true);
    expect(isSameMonth("2025-07-31", new Date(2026, 6, 1))).toBe(false);
    expect(fmtDate(monthEnd(new Date(2024, 1, 3)))).toBe("2024-02-29");
  });
});
