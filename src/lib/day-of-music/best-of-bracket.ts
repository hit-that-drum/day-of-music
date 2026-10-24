// best-of-bracket.ts — the pure half of the "Best of …" tournament: the
// single-elimination bracket, the field of contending days, and the period keys
// results are stored under. Generic so Month (over weekly winners) and Year
// (over monthly winners) reuse it. Persistence and the status hooks live in
// best-of.ts; no React here.

import { addDays, fmtDate, startOfWeek, type Album } from "@/lib/day-of-music/data";

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

// ── Bracket math ────────────────────────────────────────────────────────────

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

/** A bracket being played: the current round's matches, which one is up, and
 *  the winners picked so far this round. */
export type Tourney<T> = {
  round: number;
  matches: Match<T>[];
  /** Byes to append after this round's winners (round 1 only). */
  byes: T[];
  mi: number; // current match index within `matches`
  winners: T[]; // winners chosen so far this round
};

/** Seed a bracket (two or more entrants): round 1, its first match up. */
export function createTourney<T>(seeded: T[]): Tourney<T> {
  const { matches, byes } = firstRound(seeded);
  return { round: 1, matches, byes, mi: 0, winners: [] };
}

/** Record `winner` of the current match: the round's next match, the next
 *  round, or — when one entrant is left — the champion. */
export function advance<T>(
  tour: Tourney<T>,
  winner: T,
): { kind: "next"; tour: Tourney<T> } | { kind: "champion"; champion: T } {
  const winners = [...tour.winners, winner];
  if (tour.mi + 1 < tour.matches.length) {
    return { kind: "next", tour: { ...tour, mi: tour.mi + 1, winners } };
  }
  // Round complete: winners then byes advance (byes trail, so the last seed
  // meets the last winner).
  const advancing = [...winners, ...tour.byes];
  if (advancing.length === 1) return { kind: "champion", champion: advancing[0] };
  return {
    kind: "next",
    tour: { round: tour.round + 1, matches: pairWinners(advancing), byes: [], mi: 0, winners: [] },
  };
}

/** The stage a round is, by how many contenders enter it (byes included) — so
 *  a round of 1 match + 1 bye (3 entrants) is a semifinal, not a final. */
export function roundStage(tour: Tourney<unknown>): "final" | "semifinal" | "round" {
  const entrants = tour.matches.length * 2 + tour.byes.length;
  if (entrants <= 2) return "final";
  if (entrants <= 4) return "semifinal";
  return "round";
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

/** A stored result's champion, while its day is still in the field: the album
 *  may since have been deleted or moved, and then the result no longer counts. */
export function findSavedChampion(
  saved: BestOfResult | undefined,
  contenders: Contender[],
): Contender | undefined {
  return saved && contenders.find((c) => c.date === saved.winnerDate);
}

// ── Period keys ─────────────────────────────────────────────────────────────

/** A week segment's id = its label day (YYYY-MM-DD): the week's Monday when
 *  continuous, or the segment's first in-month day when split — so the two
 *  segments of a month-straddling week are judged and stored independently. */
export function weekPeriodKey(labelDate: Date): string {
  return fmtDate(labelDate);
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
    segments.push({ key: weekPeriodKey(labelDate), days, labelDate });
  }
  return segments;
}

/** Storage key for one result: e.g. "week:daily:2026-07-27". */
export function bestOfKey(period: BestOfPeriod, theme: string, periodKey: string): string {
  return `${period}:${theme}:${periodKey}`;
}
