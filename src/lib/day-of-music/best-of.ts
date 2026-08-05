// best-of.ts — "Best of …" tournament: pick the best day of a period by playing
// a single-elimination bracket. The bracket math is pure and generic so Month
// (over weekly winners) and Year (over monthly winners) can reuse it later.
//
// Results are persisted (latest overwrites) per (period, theme, periodKey) so a
// Best of Month can be built on top of the weekly winners. Persistence follows
// the themes.ts dual pattern: localStorage for guests, account user_metadata
// when signed in.

"use client";

import { useSyncExternalStore } from "react";

import { useAuth } from "@/components/day-of-music/auth-provider";
import { makeJsonStore } from "@/lib/day-of-music/local-store";
import { addDays, fmtDate, parseDate, startOfWeek, type Album } from "@/lib/day-of-music/data";
import { useJournal } from "@/lib/day-of-music/use-journal";
import { resolveActiveTheme, useActiveTheme, useThemes } from "@/lib/day-of-music/themes";

export type BestOfMethod = "sequential" | "random";
export type BestOfPeriod = "week" | "month" | "year";
export type BestOfResult = {
  /** YYYY-MM-DD of the winning day (resolved back to the live album via the
   *  journal, so the stored winner always reflects the latest album at that day). */
  winnerDate: string;
  method: BestOfMethod;
  /** ISO timestamp of when this result was decided (latest wins). */
  decidedAt: string;
};
export type BestOfMap = Record<string, BestOfResult>;

// ── Bracket math (pure, generic) ────────────────────────────────────────────

export type Match<T> = { a: T; b: T };

/** Smallest power of two ≥ n (n ≥ 1). */
export function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/**
 * Round 1: pair the leading seeds into real matches; the trailing seeds get
 * byes (advance without playing). Byes land at the END so the last seed sits
 * out — e.g. in day order that's Sunday, matching 월vs화 / 수vs목 / 금vs토 / 일(부전승).
 * After this round the field is a power of two, so every later round is a clean
 * pairing with no byes (see pairWinners).
 */
export function firstRound<T>(seeded: T[]): { matches: Match<T>[]; byes: T[] } {
  const n = seeded.length;
  if (n <= 1) return { matches: [], byes: [...seeded] };
  const playing = 2 * n - nextPow2(n); // even, ≥ 2 for n ≥ 2
  const matches: Match<T>[] = [];
  for (let i = 0; i < playing; i += 2) matches.push({ a: seeded[i], b: seeded[i + 1] });
  return { matches, byes: seeded.slice(playing) };
}

/** Pair an even-length list into matches (0,1),(2,3),… — used for every round
 *  after the first, where the field is already a power of two. */
export function pairWinners<T>(list: T[]): Match<T>[] {
  const matches: Match<T>[] = [];
  for (let i = 0; i + 1 < list.length; i += 2) matches.push({ a: list[i], b: list[i + 1] });
  return matches;
}

/** Fisher–Yates shuffle into a new array. Math.random is fine client-side. */
export function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── The contender field ─────────────────────────────────────────────────────

export type Contender = { date: string; album: Album };

/**
 * The days this segment judges. Normally the whole Mon–Sun week; in
 * split-by-month mode only the days in labelDate's month — e.g. a week whose
 * July part starts Wednesday contends Wed→Sun, dropping the June Mon/Tue —
 * mirroring which cells the grid keeps active.
 */
export function segmentDays(days: Date[], labelDate: Date, splitByMonth: boolean): Date[] {
  if (!splitByMonth) return days;
  const month = labelDate.getMonth();
  const year = labelDate.getFullYear();
  return days.filter((d) => d.getMonth() === month && d.getFullYear() === year);
}

/**
 * The tournament field for one week segment: its filled days, in day order.
 * Shared by the modal and the button's status so the two can never disagree
 * about who is in the running.
 */
export function weekContenders(
  days: Date[],
  albumsByDate: Record<string, Album>,
  labelDate: Date,
  splitByMonth: boolean,
): Contender[] {
  return segmentDays(days, labelDate, splitByMonth)
    .map((d) => ({ date: fmtDate(d), album: albumsByDate[fmtDate(d)] }))
    .filter((c): c is Contender => Boolean(c.album));
}

// ── Period keys ─────────────────────────────────────────────────────────────

/** Canonical week id = the week's Monday (YYYY-MM-DD). */
export function weekKey(weekStart: Date): string {
  return fmtDate(startOfWeek(weekStart));
}

/** Canonical month id = the month's 1st (YYYY-MM-DD). */
export function monthKey(anchor: Date): string {
  return fmtDate(new Date(anchor.getFullYear(), anchor.getMonth(), 1));
}

/** Last calendar day of the anchor's month. */
export function monthLastDay(anchor: Date): Date {
  return new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
}

/**
 * Every week segment that touches the anchor's month, each carrying the period
 * key its Best of Week is stored under — the same key the weekly board writes,
 * so the month can look up results the user already decided there.
 *
 * A month-straddling week behaves differently per mode, exactly as the board
 * does: split mode gives each month its own segment (two keys, judged
 * separately), while continuous mode has one shared week keyed by its Monday —
 * which is why the same week can appear in both neighbouring months here. Its
 * champion still counts for only one of them (see useBestOfMonthStatus).
 */
export function monthWeekSegments(
  anchor: Date,
  splitByMonth: boolean,
): { key: string; days: Date[]; labelDate: Date }[] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const last = monthLastDay(anchor);
  const segments: { key: string; days: Date[]; labelDate: Date }[] = [];
  for (let ws = startOfWeek(first); ws <= last; ws = addDays(ws, 7)) {
    const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
    const labelDate = segmentDays(days, first, splitByMonth)[0] ?? ws;
    segments.push({ key: fmtDate(labelDate), days, labelDate });
  }
  return segments;
}

/** Storage key for one result: e.g. "week:daily:2026-07-27". */
export function bestOfKey(period: BestOfPeriod, theme: string, periodKey: string): string {
  return `${period}:${theme}:${periodKey}`;
}

// ── Persistence (guest localStorage / signed-in user_metadata) ───────────────

const store = makeJsonStore<BestOfMap>("dom.bestof.v1", {});

/** Read/write persisted Best-of results. Signed-in users sync via
 *  user_metadata.bestOf; guests use per-device localStorage. */
export function useBestOf(): {
  get: (key: string) => BestOfResult | undefined;
  set: (key: string, result: BestOfResult) => void;
} {
  const { configured, user, updateUserMetadata } = useAuth();
  const local = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);

  if (configured && user) {
    const meta = (user.user_metadata?.bestOf as BestOfMap | undefined) ?? {};
    return {
      get: (key) => meta[key],
      // Merge into the whole map, mirroring saveThemes (updateUserMetadata
      // merges top-level keys, so we write the full bestOf object).
      set: (key, result) => void updateUserMetadata({ bestOf: { ...meta, [key]: result } }),
    };
  }
  return {
    get: (key) => local[key],
    set: (key, result) => store.set({ ...local, [key]: result }),
  };
}

// ── Status (for the entry button) ───────────────────────────────────────────

/**
 * - "done"   — already decided.
 * - "locked" — the week isn't over: a champion can only be crowned once every
 *              day has had its chance, so the field is still incomplete.
 * - "empty"  — the week is over but nothing was logged.
 * - "todo"   — playable now.
 */
export type BestOfStatus = "done" | "locked" | "empty" | "todo";

/**
 * The state of this week segment's Best of Week, so the entry button can report
 * it before it's clicked.
 *
 * "done" is judged exactly the way BestOfWeekModal judges it at mount: a stored
 * result only counts while its winning day is still a contender (the album may
 * since have been deleted or moved), or the button would promise a champion the
 * modal then re-runs from scratch. It also outranks "locked" — once a champion
 * exists the modal shows it, so hiding it behind the lock would be a lie.
 *
 * Same inputs as the modal so the two always agree; reads the active theme and
 * journal itself since the key is per (theme, segment).
 */
export function useBestOfWeekStatus(
  days: Date[],
  labelDate: Date,
  splitByMonth: boolean,
  today: Date,
): { status: BestOfStatus; winnerDate?: string; lastDay: Date } {
  const { albumsByDate } = useJournal();
  const { themes } = useThemes();
  const { activeTheme } = useActiveTheme();
  const bestOf = useBestOf();

  const segment = segmentDays(days, labelDate, splitByMonth);
  const lastDay = segment[segment.length - 1] ?? labelDate;
  const contenders = weekContenders(days, albumsByDate, labelDate, splitByMonth);

  const theme = resolveActiveTheme(themes, activeTheme);
  const saved = bestOf.get(bestOfKey("week", theme, fmtDate(labelDate)));
  if (saved && contenders.some((c) => c.date === saved.winnerDate)) {
    return { status: "done", winnerDate: saved.winnerDate, lastDay };
  }

  // Open from the segment's last day onward — Sunday for a whole week, or the
  // last in-month day of a split segment. Compared as YYYY-MM-DD so the day
  // unlocks at midnight rather than at whatever time of day `today` was built.
  if (fmtDate(lastDay) > fmtDate(today)) return { status: "locked", lastDay };

  if (contenders.length === 0) return { status: "empty", lastDay };
  return { status: "todo", lastDay };
}

/**
 * Same states as a week, plus:
 * - "pending" — the month is over but some of its weeks haven't crowned a Best
 *               of Week yet. Their champions are this tournament's field, so
 *               there is nothing to run until they exist.
 */
export type BestOfMonthStatus = BestOfStatus | "pending";

/**
 * The state of this month's Best of Month, and the field it would play.
 *
 * The field is the month's weekly champions, one per week — this is the second
 * tier the bracket math was written for. A champion counts for the month its
 * *winning day* falls in, which is what keeps a month-straddling week (shared
 * by two months in continuous mode) from being judged twice: it hands its
 * champion to exactly one side. For the same reason every week touching the
 * month must be decided before the month can run — until then the missing
 * champion's month is unknown.
 *
 * Weeks with nothing logged are not "pending": they have no champion to wait
 * for, so a month of half-empty weeks is still playable.
 */
export function useBestOfMonthStatus(
  anchor: Date,
  splitByMonth: boolean,
  today: Date,
): {
  status: BestOfMonthStatus;
  /** The month's weekly champions — the tournament field. */
  contenders: Contender[];
  winnerDate?: string;
  /** Weeks that have entries but no champion yet (drives the "pending" hint). */
  pendingWeeks: number;
  lastDay: Date;
} {
  const { albumsByDate } = useJournal();
  const { themes } = useThemes();
  const { activeTheme } = useActiveTheme();
  const bestOf = useBestOf();

  const theme = resolveActiveTheme(themes, activeTheme);
  const lastDay = monthLastDay(anchor);
  const month = anchor.getMonth();
  const year = anchor.getFullYear();

  const contenders: Contender[] = [];
  let pendingWeeks = 0;
  for (const seg of monthWeekSegments(anchor, splitByMonth)) {
    const field = weekContenders(seg.days, albumsByDate, seg.labelDate, splitByMonth);
    if (field.length === 0) continue; // nothing was logged that week — no champion owed
    const saved = bestOf.get(bestOfKey("week", theme, seg.key));
    const champion = saved && field.find((c) => c.date === saved.winnerDate);
    if (!champion) {
      pendingWeeks += 1;
      continue;
    }
    const d = parseDate(champion.date);
    if (d.getMonth() === month && d.getFullYear() === year) contenders.push(champion);
  }

  const saved = bestOf.get(bestOfKey("month", theme, monthKey(anchor)));
  if (saved && contenders.some((c) => c.date === saved.winnerDate)) {
    return { status: "done", contenders, winnerDate: saved.winnerDate, pendingWeeks, lastDay };
  }
  if (fmtDate(lastDay) > fmtDate(today)) {
    return { status: "locked", contenders, pendingWeeks, lastDay };
  }
  if (pendingWeeks > 0) return { status: "pending", contenders, pendingWeeks, lastDay };
  if (contenders.length === 0) return { status: "empty", contenders, pendingWeeks, lastDay };
  return { status: "todo", contenders, pendingWeeks, lastDay };
}
