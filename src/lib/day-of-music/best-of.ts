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
import { fmtDate, startOfWeek } from "@/lib/day-of-music/data";

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

// ── Period keys ─────────────────────────────────────────────────────────────

/** Canonical week id = the week's Monday (YYYY-MM-DD). */
export function weekKey(weekStart: Date): string {
  return fmtDate(startOfWeek(weekStart));
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
