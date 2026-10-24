// best-of.ts — "Best of …" tournament: pick the best day of a period by playing
// a single-elimination bracket (the pure bracket math, field and period keys
// are in best-of-bracket.ts; this file is persistence and the status hooks).
//
// Results are persisted (latest overwrites) per (period, theme, periodKey) so a
// Best of Month can be built on top of the weekly winners. Signed-in users keep
// them in public.best_of; guests use per-device localStorage.
//
// These used to live in user_metadata, next to `themes`. That was wrong for
// data that grows: Supabase embeds user_metadata in the access token, and the
// token is sent as the Authorization header on every PostgREST request, so each
// finished tournament made every subsequent request bigger. At 11.7 KiB of
// results the header outgrew what WebKit will send and Safari killed each
// connection ("The network connection was lost") while Chrome kept working.
// `themes` is a fixed handful of lanes and stays where it is; this doesn't.

"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useAuth, type AuthResult } from "@/lib/day-of-music/auth-provider";
import {
  bestOfKey,
  findSavedChampion,
  monthKey,
  monthWeekSegments,
  weekContenders,
  weekPeriodKey,
  type BestOfMap,
  type BestOfMethod,
  type BestOfResult,
  type Contender,
} from "@/lib/day-of-music/best-of-bracket";
import { makeJsonStore, useStore } from "@/lib/day-of-music/local-store";
import { getSupabaseBrowserClient, runQuery } from "@/lib/supabase/client";
import { fmtDate, isSameMonth, monthEnd, segmentDays } from "@/lib/day-of-music/data";
import { useJournal } from "@/lib/day-of-music/use-journal";
import { resolveActiveTheme, useActiveTheme, useThemes } from "@/lib/day-of-music/themes";
import { useT } from "@/lib/day-of-music/i18n";
import { readUserMetadata, type UserMetadata } from "@/lib/day-of-music/user-metadata";

// ── Persistence (guest localStorage / signed-in public.best_of) ──────────────

const store = makeJsonStore<BestOfMap>("dom.bestof.v1", {});

// Row shape of public.best_of (snake_case), see 0009_best_of.sql.
type BestOfRow = {
  key: string;
  winner_date: string;
  method: BestOfMethod;
  decided_at: string;
};

function rowsToMap(rows: BestOfRow[]): BestOfMap {
  const map: BestOfMap = {};
  for (const r of rows) {
    map[r.key] = { winnerDate: r.winner_date, method: r.method, decidedAt: r.decided_at };
  }
  return map;
}

/** The row written for one result — the inverse of rowsToMap's mapping. */
function toRow(userId: string, key: string, r: BestOfResult): BestOfRow & { user_id: string } {
  return { user_id: userId, key, winner_date: r.winnerDate, method: r.method, decided_at: r.decidedAt };
}

// Signed in, before the table has loaded: one stable empty map.
const NO_RESULTS: BestOfMap = {};

// Accounts whose user_metadata.bestOf move has started this page load. Module-
// wide because several components use useBestOf at once (the board's buttons
// and an open modal), and each would otherwise start the same move.
const migratingUsers = new Set<string>();

/** Move anything still in user_metadata.bestOf into the table, then clear the
 *  key so the account's access token shrinks back to a normal size — which is
 *  the whole point of the migration, and the only way an already-bloated
 *  account recovers without being touched by hand. Rejects if either step
 *  fails, leaving the metadata in place to retry. */
async function migrateLegacyBestOf(
  userId: string,
  legacy: BestOfMap,
  remote: BestOfMap,
  updateUserMetadata: (patch: Partial<UserMetadata>) => Promise<AuthResult>,
): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;
  // Table rows win over the legacy copy, so a result decided since the move
  // isn't rolled back by a stale token still carrying the old map.
  const rows = Object.entries(legacy)
    .filter(([key]) => !remote[key])
    .map(([key, r]) => toRow(userId, key, r));
  if (rows.length) {
    await runQuery(
      "best_of migration upsert",
      supabase.from("best_of").upsert(rows, { onConflict: "user_id,key" }),
    );
  }
  // Only drop the metadata once the rows are safely persisted.
  const { error } = await updateUserMetadata({ bestOf: null });
  if (error) throw new Error(error);
}

async function fetchBestOf(userId: string | null): Promise<BestOfMap> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase || !userId) return {};
  const { data } = await runQuery(
    "best_of select",
    supabase.from("best_of").select("key, winner_date, method, decided_at"),
  );
  return rowsToMap(data as BestOfRow[]);
}

/** Read/write persisted Best-of results. The map is loaded once and read
 *  synchronously, so callers keep the same shape they had when this was backed
 *  by user_metadata — only the storage underneath changed. `get` changes only
 *  with the results and `set` only on sign-in/out, so both can be effect deps. */
export function useBestOf(): {
  get: (key: string) => BestOfResult | undefined;
  set: (key: string, result: BestOfResult) => void;
} {
  const { configured, user, updateUserMetadata } = useAuth();
  const t = useT();
  const userId = user?.id ?? null;
  const signedIn = configured && Boolean(user);
  const local = useStore(store);
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ["bestOf", userId ?? "anon"] as const, [userId]);

  const query = useQuery({
    queryKey,
    queryFn: () => fetchBestOf(userId),
    enabled: signedIn,
  });

  const upsert = useMutation({
    mutationFn: async ({ key, result }: { key: string; result: BestOfResult }) => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase || !userId) return;
      await runQuery(
        "best_of upsert",
        supabase.from("best_of").upsert(toRow(userId, key, result), { onConflict: "user_id,key" }),
      );
    },
    onMutate: ({ key, result }) => {
      const previous = queryClient.getQueryData<BestOfMap>(queryKey);
      queryClient.setQueryData<BestOfMap>(queryKey, { ...(previous ?? {}), [key]: result });
      return { previous };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(queryKey, ctx.previous);
      toast.error(t("toast.saveFailed"), { description: err.message });
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey }),
  });

  // A destructured mutate is stable across renders; the mutation object isn't.
  const { mutate } = upsert;

  const remote = query.data;
  // One-time move of anything still in user_metadata.bestOf (see
  // migrateLegacyBestOf), once the table's own rows have loaded.
  useEffect(() => {
    if (!signedIn || !userId || !user || !remote || migratingUsers.has(userId)) return;
    const legacy = readUserMetadata(user).bestOf;
    if (!legacy || !Object.keys(legacy).length) return;
    migratingUsers.add(userId);
    migrateLegacyBestOf(userId, legacy, remote, updateUserMetadata).then(
      () => void queryClient.invalidateQueries({ queryKey }),
      (e: unknown) => {
        // Retry on the next load: a failed move must not lose results.
        migratingUsers.delete(userId);
        console.error("best_of: migration from user_metadata failed", e);
      },
    );
  }, [signedIn, userId, remote, user, updateUserMetadata, queryClient, queryKey]);

  const results = signedIn ? (remote ?? NO_RESULTS) : local;
  const get = useCallback((key: string) => results[key], [results]);
  const set = useCallback(
    (key: string, result: BestOfResult) => {
      if (signedIn) mutate({ key, result });
      // From the store itself, not this render's snapshot, so two writes in a
      // row both land.
      else store.set({ ...store.getSnapshot(), [key]: result });
    },
    [signedIn, mutate],
  );
  return useMemo(() => ({ get, set }), [get, set]);
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
  const champion = findSavedChampion(
    bestOf.get(bestOfKey("week", theme, weekPeriodKey(labelDate))),
    contenders,
  );
  if (champion) return { status: "done", winnerDate: champion.date, lastDay };

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
  const lastDay = monthEnd(anchor);

  const contenders: Contender[] = [];
  let pendingWeeks = 0;
  for (const seg of monthWeekSegments(anchor, splitByMonth)) {
    const field = weekContenders(seg.days, albumsByDate, seg.labelDate, splitByMonth);
    if (field.length === 0) continue; // nothing was logged that week — no champion owed
    const champion = findSavedChampion(bestOf.get(bestOfKey("week", theme, seg.key)), field);
    if (!champion) {
      pendingWeeks += 1;
      continue;
    }
    if (isSameMonth(champion.date, anchor)) contenders.push(champion);
  }

  const champion = findSavedChampion(bestOf.get(bestOfKey("month", theme, monthKey(anchor))), contenders);
  if (champion) {
    return { status: "done", contenders, winnerDate: champion.date, pendingWeeks, lastDay };
  }
  if (fmtDate(lastDay) > fmtDate(today)) {
    return { status: "locked", contenders, pendingWeeks, lastDay };
  }
  if (pendingWeeks > 0) return { status: "pending", contenders, pendingWeeks, lastDay };
  if (contenders.length === 0) return { status: "empty", contenders, pendingWeeks, lastDay };
  return { status: "todo", contenders, pendingWeeks, lastDay };
}
