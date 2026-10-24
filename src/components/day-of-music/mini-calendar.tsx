// mini-calendar.tsx — what the two mini month calendars share: the week rows
// of the month on screen. WeekPicker (week-picker.tsx) jumps the board to a
// week; DayPicker (day-picker.tsx) picks one day in Day Detail.

"use client";

import { useMemo } from "react";
import type { Dayjs } from "dayjs";

import { monthGrid } from "@/lib/day-of-music/data";

// Mon-first week rows covering the cursor's month (the month grid, by week).
export function useMonthWeeks(cursor: Dayjs) {
  return useMemo(() => {
    const { days, numWeeks } = monthGrid(cursor.toDate());
    const weeks = Array.from({ length: numWeeks }, (_, w) => days.slice(w * 7, w * 7 + 7));
    return { weeks, monthIndex: cursor.month() };
  }, [cursor]);
}
