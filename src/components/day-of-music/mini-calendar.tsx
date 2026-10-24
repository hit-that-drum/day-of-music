// mini-calendar.tsx — what the two mini month calendars share: the week rows
// of the month on screen, and an Esc that closes only the calendar. WeekPicker
// (week-picker.tsx) jumps the board to a week; DayPicker (day-picker.tsx)
// picks one day in Day Detail.

"use client";

import { useEffect, useMemo } from "react";
import type { Dayjs } from "dayjs";

import { monthGrid } from "@/lib/day-of-music/data";

// Esc closes only the innermost picker: capture phase + stopPropagation so the
// Modal's bubble-phase listener (modal.tsx) and DayOfMusicApp's closeAll never
// see the event while a picker is open.
export function useCapturedEscape(onEscape: () => void) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onEscape();
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onEscape]);
}

// Mon-first week rows covering the cursor's month (the month grid, by week).
export function useMonthWeeks(cursor: Dayjs) {
  return useMemo(() => {
    const { days, numWeeks } = monthGrid(cursor.toDate());
    const weeks = Array.from({ length: numWeeks }, (_, w) => days.slice(w * 7, w * 7 + 7));
    return { weeks, monthIndex: cursor.month() };
  }, [cursor]);
}
