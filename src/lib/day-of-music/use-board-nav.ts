// use-board-nav.ts — which page of the board is on screen, and how ←/→ move
// it. `anchor` is any day inside the page; the week strip, its label day and
// the month view all derive from it.

import { useCallback, useMemo, useState } from "react";

import {
  addDays,
  monthEnd,
  monthStart,
  segmentDays,
  startOfWeek,
  weekDays,
} from "@/lib/day-of-music/data";

/** One week page back or forward from `cur`. Split by month, a page is the
 *  part of a Mon–Sun week inside one month, so the step lands just past the
 *  visible segment rather than a full 7 days on. */
export function stepWeek(cur: Date, dir: -1 | 1, splitByMonth: boolean): Date {
  if (!splitByMonth) return addDays(cur, 7 * dir);
  const ws = startOfWeek(cur);
  if (dir < 0) {
    const first = monthStart(cur);
    return addDays(ws < first ? first : ws, -1);
  }
  const weekEnd = addDays(ws, 6);
  const last = monthEnd(cur);
  return addDays(weekEnd > last ? last : weekEnd, 1);
}

/** The 1st of the month before or after `cur`'s (native Date rolls the year). */
export function stepMonth(cur: Date, dir: -1 | 1): Date {
  return new Date(cur.getFullYear(), cur.getMonth() + dir, 1);
}

export function useBoardNav(today: Date, splitByMonth: boolean) {
  // null means "follow today": the board opens on today's week and still
  // tracks it if the post-hydration correction moves today (first visit from a
  // zone a day ahead of the server, across a week boundary). Once the user has
  // navigated, the page they picked stays put — including a navigation that
  // beats the correction (a click replayed during hydration), which keeps the
  // server's week.
  const [pickedAnchor, setAnchor] = useState<Date | null>(null);
  const anchor = pickedAnchor ?? today;

  // The grid always shows the whole Mon–Sun week (7 cells). In split mode the
  // cells belonging to the *other* month are blanked out by WeeklyGrid rather
  // than removed, so the 7-column layout stays intact.
  const weekStart = useMemo(() => startOfWeek(anchor), [anchor]);
  const days = useMemo(() => weekDays(weekStart), [weekStart]);
  // The day whose month/week-number labels the page — the header, the share
  // card, Best of Week: the first in-month day when split, else the Monday.
  const labelDate = useMemo(
    () => segmentDays(days, anchor, splitByMonth)[0] ?? weekStart,
    [days, anchor, splitByMonth, weekStart],
  );

  // The updaters resolve a null (follow-today) anchor themselves.
  const prevWeek = useCallback(
    () => setAnchor((a) => stepWeek(a ?? today, -1, splitByMonth)),
    [today, splitByMonth],
  );
  const nextWeek = useCallback(
    () => setAnchor((a) => stepWeek(a ?? today, 1, splitByMonth)),
    [today, splitByMonth],
  );
  const prevMonth = useCallback(() => setAnchor((a) => stepMonth(a ?? today, -1)), [today]);
  const nextMonth = useCallback(() => setAnchor((a) => stepMonth(a ?? today, 1)), [today]);

  return { anchor, setAnchor, days, labelDate, prevWeek, nextWeek, prevMonth, nextMonth };
}
