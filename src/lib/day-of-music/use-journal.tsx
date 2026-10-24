// use-journal.tsx — journal persistence layer.
// The TanStack Query cache is the single source of truth. Signed-in users read
// and write journal_entries directly via supabase-js (RLS scopes rows to the
// user — see supabase/migrations/). Guests are purely in-memory. When Supabase
// isn't configured at all (bare local dev), entries live in localStorage.

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { Album } from "@/lib/day-of-music/data";
import {
  CUSTOM_ALBUMS_STORAGE_KEY,
  JOURNAL_STORAGE_KEY,
  type JournalAlbum,
  type JournalEntry,
  type JournalPatch,
} from "@/lib/day-of-music/journal";
import { albumFromDetail, fetchAlbumDetail } from "@/lib/day-of-music/music-search";
import { TRACKLIST_VERSION } from "@/lib/day-of-music/music-types";
import { useCountry } from "@/lib/day-of-music/profile";
import {
  DEFAULT_THEME_ID,
  resolveActiveTheme,
  useActiveTheme,
  useThemes,
} from "@/lib/day-of-music/themes";
import { useAuth } from "@/lib/day-of-music/auth-provider";
import {
  applyRemove,
  applySwap,
  applyUpsert,
  mergeEntry,
  normalizeAlbum,
  restoreSlots,
  slotAlbum,
  type JournalCache,
} from "@/lib/day-of-music/journal-cache";
import { useT } from "@/lib/day-of-music/i18n";
import { getSupabaseBrowserClient, runQuery } from "@/lib/supabase/client";

type PatchMap = Record<string, JournalPatch>;
// Mutation variables. An upsert fills one or more (theme, album.date) slots of
// one theme, so the same album logged on several days is a single request.
// `optimistic: false` lets a multi-write caller (moveSlot) own the cache update
// + rollback so the per-call optimistic logic is skipped.
type UpsertVars = { slots: Album[]; theme: string; optimistic?: boolean };
type RemoveVars = { date: string; theme: string; optimistic?: boolean };
// `albums` carries the full metadata for every logged album so a second device
// can render entries it never saw created. Built from each row's `album` blob.
type JournalResponse = JournalCache;

// Row shape of public.journal_entries (snake_case). `theme` is not null
// (default 'daily') since 0004_themes.sql; `album` is null on rows older
// than 0002_album_metadata.sql.
type JournalRow = {
  album_id: string;
  date: string;
  rating: number;
  note: string;
  theme: string;
  // jsonb the database doesn't check — read through normalizeAlbum.
  album: unknown;
};

const JournalContext = createContext<JournalContextValue | null>(null);

type JournalContextValue = {
  albums: Album[];
  allAlbums: JournalAlbum[];
  albumsByDate: Record<string, Album>;
  /** Log (or replace) the album in the active theme's slot on each of
   *  `dates` — one write, saved or rolled back as a whole. */
  logAlbum: (album: Album, entry: { dates: string[]; rating: number; note: string }) => void;
  /** Update the slot at `date` while keeping the same album id/date. */
  updateSlot: (date: string, patch: Partial<Album>) => void;
  /** Move (or swap) the album between two dates within the active theme.
   *  Resolves true once the writes settle (or there was nothing to do), false
   *  when a write was rejected and the cache snapshot was restored. Never rejects. */
  moveSlot: (fromDate: string, toDate: string) => Promise<boolean>;
  /** Clear the slot at `date`. */
  removeSlot: (date: string) => void;
  /** Enrich the album in the slot at `date` (tracklist/release date). */
  enrichSlot: (date: string, patch: Partial<Album>) => void;
};

function readLocalEntries(): JournalEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(JOURNAL_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      // v2: array of full entries (with theme).
      return (parsed as Partial<JournalEntry>[]).map((e) => ({
        albumId: e.albumId ?? "",
        date: e.date ?? "",
        rating: e.rating ?? 0,
        note: e.note ?? "",
        theme: e.theme ?? DEFAULT_THEME_ID,
      }));
    }
    // v1: map keyed by albumId, no theme → default theme.
    const map = parsed as PatchMap;
    return Object.entries(map).map(([albumId, p]) => ({
      albumId,
      date: p.date ?? "",
      rating: p.rating ?? 0,
      note: p.note ?? "",
      theme: DEFAULT_THEME_ID,
    }));
  } catch {
    return [];
  }
}

function writeLocalEntries(entries: JournalEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    // v2 format: a flat array so multiple themes per album are preserved.
    window.localStorage.setItem(JOURNAL_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    /* ignore quota / privacy-mode errors */
  }
}

async function fetchJournal(userId: string | null): Promise<JournalResponse> {
  const supabase = getSupabaseBrowserClient();

  // Unconfigured local dev: localStorage is the only persistence.
  if (!supabase || !userId) {
    return { entries: readLocalEntries(), albums: readCustomAlbums() };
  }

  // Bounded: a select() waits on supabase-js resolving an access token, which
  // is serialised behind the same Web Lock as the auth calls. If that lock is
  // never released the promise stays pending, and a pending query renders as a
  // blank board forever — never as an error, so nothing reports it. A deadline
  // turns that into a failure the caller can actually show.
  const { data } = await runQuery(
    "journal select",
    supabase
      .from("journal_entries")
      .select("album_id, date, rating, note, theme, album")
      .order("date"),
  );

  const rows = data as JournalRow[];
  return {
    entries: rows.map((r) => ({
      albumId: r.album_id,
      date: r.date,
      rating: r.rating,
      note: r.note,
      theme: r.theme,
    })),
    // Older rows predate the `album` column and come back null — those albums
    // get backfilled from localStorage by the effect in JournalProvider.
    albums: rows.flatMap((r) => normalizeAlbum(r.album, r.album_id) ?? []),
  };
}

// The album metadata pool in local mode (no Supabase), saved alongside the
// entries. Signed-in devices also kept one here before metadata synced to the
// journal rows; it is now only read, once, to backfill those rows.
function readCustomAlbums(): Album[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_ALBUMS_STORAGE_KEY);
    const saved: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(saved) ? saved.flatMap((a) => normalizeAlbum(a) ?? []) : [];
  } catch {
    return [];
  }
}

function writeCustomAlbums(albums: Album[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CUSTOM_ALBUMS_STORAGE_KEY, JSON.stringify(albums));
  } catch {
    /* ignore quota / privacy-mode errors */
  }
}

// Tail of the pending-move chain (see moveSlot): each move waits for the one
// before it so a rollback can never wipe a later move's staging.
let moveChainTail: Promise<unknown> = Promise.resolve();

export function JournalProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { configured, user } = useAuth();
  const t = useT();
  const country = useCountry();
  const userId = user?.id ?? null;
  const queryKey = useMemo(() => ["journal", userId ?? "anon"] as const, [userId]);

  // Guest = auth is configured but nobody is signed in. Guests work entirely
  // in-memory (query cache only): no fetch, no localStorage, no server writes —
  // so leaving the page resets everything to the initial catalog.
  const guest = configured && !user;

  // The calendar shows one themed lane at a time. Clamp to a real theme so a
  // stale active id (deleted theme) doesn't blank the board.
  const { themes } = useThemes();
  const { activeTheme } = useActiveTheme();
  const theme = useMemo(
    () => resolveActiveTheme(themes, activeTheme),
    [themes, activeTheme],
  );

  const query = useQuery({
    queryKey,
    queryFn: () => fetchJournal(userId),
    // In auth mode, only load once signed in; in unconfigured mode, always.
    enabled: !configured || Boolean(user),
  });

  // A failed load renders exactly like an empty journal — same blank board, no
  // hint that anything went wrong. That made a Safari-only outage (supabase-js
  // rejecting on a Web Lock timeout) indistinguishable from "you logged
  // nothing". Say so instead, and keep the reason in the console for a report.
  const queryError = query.error;
  // An Effect Event so a language change re-renders the next toast without
  // re-announcing an error that is still the same one.
  const notifyLoadFailed = useEffectEvent((error: unknown) => {
    toast.error(
      t("toast.loadFailed", { reason: error instanceof Error ? error.message : String(error) }),
    );
  });
  useEffect(() => {
    if (!queryError) return;
    console.error("journal load failed", queryError);
    notifyLoadFailed(queryError);
  }, [queryError]);

  const queryData = query.data;
  // Album metadata pool, keyed by album id (theme/date independent): the
  // cache's own album list — the synced Supabase blobs when signed in (the
  // cross-device source of truth), localStorage in local mode, this session's
  // albums for guests. Every metadata change goes through the upsert below,
  // whose optimistic update writes it here, so a new album shows at once.
  const dbAlbums = queryData?.albums;
  const poolById = useMemo(() => new Map((dbAlbums ?? []).map((a) => [a.id, a])), [dbAlbums]);

  // The board is built directly from the active theme's entries, keyed by date
  // (one album per day per theme). The same album can fill multiple days. This
  // intentionally recomputes whenever `poolById` changes (e.g. a metadata
  // enrich) so every day showing that album re-renders — correct, and cheap at
  // this scale.
  const albumsByDate = useMemo(() => {
    const out: Record<string, Album> = {};
    for (const e of queryData?.entries ?? []) {
      if (e.theme !== theme) continue;
      const meta = poolById.get(e.albumId);
      if (!meta) continue; // metadata not loaded yet (recovery handles it)
      out[e.date] = mergeEntry(meta, e);
    }
    return out;
  }, [queryData, theme, poolById]);
  const albums = useMemo(() => Object.values(albumsByDate), [albumsByDate]);
  const allAlbums = useMemo<JournalAlbum[]>(() => {
    const out: JournalAlbum[] = [];
    for (const e of queryData?.entries ?? []) {
      const meta = poolById.get(e.albumId);
      if (!meta) continue;
      out.push({ ...mergeEntry(meta, e), theme: e.theme });
    }
    return out;
  }, [queryData, poolById]);

  // Takes the full merged Album for each slot so the album's metadata is
  // persisted alongside its journal overlay — that metadata blob is what lets
  // another device render the entry. The journal columns (date/rating/note) are
  // derived from it.
  const upsert = useMutation({
    mutationFn: async ({ slots, theme: lane }: UpsertVars) => {
      // Guests: the optimistic cache update in onMutate is their whole
      // persistence. Unconfigured: localStorage write-through in onMutate.
      const supabase = getSupabaseBrowserClient();
      if (guest || !supabase || !userId) return;

      // One row per slot, all in one statement, which commits or fails as a
      // whole: a failed multi-day log leaves none of its days half-saved.
      const rows = slots.map((album) => ({
        user_id: userId,
        theme: lane,
        album_id: album.id,
        date: album.date,
        rating: album.rating,
        note: album.note,
        album,
      }));
      // The slot is (user_id, theme, date) — one album per day per theme.
      // Bounded like fetchJournal: a write pending forever behind the auth Web
      // Lock would otherwise never reject, and moveSlot's write chain (below)
      // would stall every later move behind it.
      await runQuery(
        "journal upsert",
        supabase.from("journal_entries").upsert(rows, { onConflict: "user_id,theme,date" }),
      );
    },
    onMutate: ({ slots, theme: lane, optimistic = true }) => {
      // moveSlot updates the cache itself (one atomic swap with a single
      // rollback), so it opts out of this per-call optimistic update.
      if (!optimistic) return { previous: undefined };
      const previous = queryClient.getQueryData<JournalResponse>(queryKey);
      // Replace whatever was in each of these (theme, date) slots.
      const next = slots.reduce(
        (cache, album) => applyUpsert(cache, album, lane),
        previous ?? { entries: [], albums: [] },
      );
      queryClient.setQueryData<JournalResponse>(queryKey, next);
      // localStorage write-through only in unconfigured (no-Supabase) mode.
      if (!configured) {
        writeLocalEntries(next.entries);
        writeCustomAlbums(next.albums);
      }
      return { previous };
    },
    onError: (err, vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(queryKey, ctx.previous);
      // moveSlot (optimistic:false) owns its own failure toast.
      if (vars.optimistic !== false) toast.error(t("toast.saveFailed"), { description: err.message });
    },
    // moveSlot runs two legs back to back; a refetch kicked off after the FIRST
    // leg could land mid-sequence and briefly show the half-moved server state.
    // It invalidates once itself, after both legs (and any compensation) settle.
    onSettled: (_data, _err, vars) => {
      if (vars.optimistic !== false) queryClient.invalidateQueries({ queryKey });
    },
  });

  const remove = useMutation({
    mutationFn: async ({ date, theme: lane }: RemoveVars) => {
      const supabase = getSupabaseBrowserClient();
      if (guest || !supabase || !userId) return;
      await runQuery(
        "journal delete",
        supabase
          .from("journal_entries")
          .delete()
          .eq("user_id", userId)
          .eq("theme", lane)
          .eq("date", date),
      );
    },
    onMutate: ({ date, theme: lane, optimistic = true }) => {
      // moveSlot manages the cache atomically; skip the per-call update.
      if (!optimistic) return { previous: undefined };
      const previous = queryClient.getQueryData<JournalResponse>(queryKey);
      // Clear just this (theme, date) slot; album metadata stays in the pool.
      const next = applyRemove(previous ?? { entries: [], albums: [] }, date, lane);
      queryClient.setQueryData<JournalResponse>(queryKey, next);
      if (!configured) writeLocalEntries(next.entries);
      return { previous };
    },
    onError: (err, vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(queryKey, ctx.previous);
      // As in upsert: moveSlot (optimistic:false) owns its own failure toast.
      if (vars.optimistic !== false) toast.error(t("toast.removeFailed"), { description: err.message });
    },
    // Same gate as upsert.onSettled: moveSlot invalidates once, at the end.
    onSettled: (_data, _err, vars) => {
      if (vars.optimistic !== false) queryClient.invalidateQueries({ queryKey });
    },
  });

  // Destructure the mutate functions: they're referentially stable across
  // renders, so depending on them (rather than the fresh mutation object) keeps
  // the callbacks/effect below memoized and satisfies exhaustive-deps.
  const { mutate: upsertMutate, mutateAsync: upsertAsync } = upsert;
  const { mutate: removeMutate, mutateAsync: removeAsync } = remove;

  // Log / replace the album in the active theme's slot on each of the dates.
  const logAlbum = useCallback<JournalContextValue["logAlbum"]>(
    (album, { dates, rating, note }) => {
      // Distinct days only: one upsert statement can't write the same slot twice.
      const days = [...new Set(dates)];
      if (days.length === 0) return;
      upsertMutate({ slots: days.map((date) => ({ ...album, date, rating, note })), theme });
    },
    [upsertMutate, theme],
  );

  // Update the slot at a date (keeps the same album id + slot date).
  const updateSlot = useCallback<JournalContextValue["updateSlot"]>(
    (date, patch) => {
      const base = albumsByDate[date];
      if (!base) return;
      const merged = { ...base, ...patch, date };
      // Re-persist the whole album so its metadata blob isn't dropped.
      upsertMutate({ slots: [merged], theme });
    },
    [albumsByDate, upsertMutate, theme],
  );

  // Move (or swap) the album between two dates within the active theme. A move
  // is two writes (or one write + one delete). Applying them as two independent
  // optimistic mutations risks a half-rolled-back board if the second write
  // fails, so the whole swap is staged in the cache once, with a single
  // snapshot, and the writes run SEQUENTIALLY with optimistic:false. Any
  // rejection restores that one snapshot and resolves false so the caller
  // (Day Detail's reschedule) can report it; DnD callers ignore the result.
  //
  // Staging is SYNCHRONOUS (the board shows the move before the caller's toast,
  // and a second DnD drop never waits on the first one's network); only the
  // WRITES are serialized. The board stays interactive while a move's writes
  // are in flight (the detail closes at once; DnD never waited), so two moves'
  // legs could otherwise interleave on the server (A→B then B→C: the second
  // move's delete of B racing the first's upsert onto B). Each move's writes
  // therefore wait for the previous move's to settle, and a rollback restores
  // only the two slots that move touched — never a later move's staging. The
  // tail lives at module level: there is
  // one JournalProvider per app, and the compiler lint rejects a ref or a
  // useState holder mutated from a callback that is handed out via context.
  const moveSlot = useCallback<JournalContextValue["moveSlot"]>(
    (fromDate, toDate) => {
      if (fromDate === toDate) return Promise.resolve(true);

      // Resolve both slots from the cache as it stands NOW — a move staged
      // earlier in the same tick is already in it, unlike the render-time memo.
      const base = queryClient.getQueryData<JournalResponse>(queryKey) ?? {
        entries: [],
        albums: [],
      };
      const a = slotAlbum(base, theme, fromDate, poolById);
      if (!a) return Promise.resolve(false);
      const b = slotAlbum(base, theme, toDate, poolById);

      // Drop both slots in this theme, then re-add them swapped.
      const swapped = applySwap(base, theme, fromDate, toDate, a, b);
      queryClient.setQueryData<JournalResponse>(queryKey, swapped);
      if (!configured) writeLocalEntries(swapped.entries);

      // Restore just the two touched slots on top of whatever the cache holds
      // by then, so a later move's staging on other days survives. (A later
      // move that reused one of these days is reconciled by the refetch.)
      const rollback = () => {
        const cur = queryClient.getQueryData<JournalResponse>(queryKey) ?? base;
        const restored = restoreSlots(cur, base, theme, fromDate, toDate);
        queryClient.setQueryData<JournalResponse>(queryKey, restored);
        if (!configured) writeLocalEntries(restored.entries);
      };
      // Sequenced, not parallel: a rejected FIRST write leaves the server
      // untouched, so the rollback is the literal truth. Only a rejected second
      // leg can leave a partial state — `a` on both days when the delete fails
      // (no loss), or `b` overwritten when a swap's second upsert fails — so the
      // swap case re-upserts `b` on its original day before giving up, and the
      // finally-invalidate refetches whatever the server really holds.
      const writes = (): Promise<boolean> =>
        upsertAsync({ slots: [{ ...a, date: toDate }], theme, optimistic: false })
          .then(() =>
            b
              ? upsertAsync({ slots: [{ ...b, date: fromDate }], theme, optimistic: false }).catch(
                  async (err: unknown) => {
                    // `b` still carries `date: toDate` — this is "put it back".
                    await upsertAsync({ slots: [b], theme, optimistic: false }).catch(() => undefined);
                    throw err;
                  },
                )
              : removeAsync({ date: fromDate, theme, optimistic: false }),
          )
          .then(
            () => true,
            () => {
              rollback();
              return false;
            },
          )
          .finally(() => queryClient.invalidateQueries({ queryKey }));

      const run = moveChainTail.then(writes);
      // The chain itself never rejects (writes resolves false on failure; this
      // guard only covers a synchronous throw), so later moves always run.
      moveChainTail = run.catch(() => undefined);
      return run;
    },
    [poolById, queryClient, queryKey, theme, configured, upsertAsync, removeAsync],
  );

  const enrichSlot = useCallback<JournalContextValue["enrichSlot"]>(
    (date, patch) => {
      const base = albumsByDate[date];
      // Only user-added (itunes) albums need lazy enrichment.
      if (!base || !base.id.startsWith("itunes-")) return;
      const merged = { ...base, ...patch };
      // Re-saving the slot refreshes the album in the metadata pool (so every
      // day showing it re-renders) and, when signed in, syncs the row.
      upsertMutate({ slots: [merged], theme });
    },
    [albumsByDate, upsertMutate, theme],
  );

  const removeSlot = useCallback<JournalContextValue["removeSlot"]>(
    (date) => removeMutate({ date, theme }),
    [removeMutate, theme],
  );

  // Backfill: entries created before metadata sync existed have their album
  // blob only in this device's localStorage. On the device that still holds it,
  // push it up so other devices (where the entry loads but the album is blank)
  // can finally render it. Self-terminating — once the row has a blob, the
  // refetch includes it and it drops out of `missing`. The ref stops us from
  // re-firing the same id while its upsert is in flight.
  const backfilledRef = useRef<Set<string>>(new Set());
  // This device's pre-sync album copies, read from localStorage once.
  const legacyAlbumsRef = useRef<Map<string, Album> | null>(null);
  useEffect(() => {
    if (guest || !configured || !user || !queryData) return;
    const synced = new Set(queryData.albums.map((a) => a.id));
    legacyAlbumsRef.current ??= new Map(readCustomAlbums().map((a) => [a.id, a]));
    const local = legacyAlbumsRef.current;
    const missing = queryData.entries.filter(
      (e) =>
        !synced.has(e.albumId) &&
        !backfilledRef.current.has(e.albumId) &&
        local.has(e.albumId),
    );
    for (const e of missing) {
      const meta = local.get(e.albumId);
      if (!meta) continue;
      backfilledRef.current.add(e.albumId);
      upsertMutate({ slots: [mergeEntry(meta, e)], theme: e.theme });
    }
  }, [guest, configured, user, queryData, upsertMutate]);

  // Recover album metadata that's missing on this device entirely — older rows
  // whose `album` blob is null AND whose blob isn't in this device's
  // localStorage (e.g. logged on another computer, before metadata sync). The
  // album id encodes the Apple catalog id ("itunes-<collectionId>"), so we
  // re-fetch the metadata from Apple and persist it back to the row. Unlike the
  // localStorage backfill above this is device-independent, and it self-heals
  // the row so every device renders the entry afterwards. Each id is attempted
  // once per session (even on failure) to avoid loops.
  const recoveredRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!queryData) return;
    // "Known" = album ids we already have metadata for (any theme), so we only
    // refetch entries whose metadata is genuinely missing here.
    const known = new Set(poolById.keys());
    // Only "itunes-" (album) ids can be rebuilt from a Lookup via albumFromDetail.
    // "itrack-" ids encode a single track ("itrack-<collectionId>-<trackId>") and
    // can't be reconstructed by this album path, so they're skipped — harmless
    // today since their metadata is stored inline on the row. If cross-device
    // recovery for tracks is needed later, add a track-specific rebuild here
    // (resolve the track within the looked-up album), not just a prefix check.
    const missing = queryData.entries.filter(
      (e) =>
        e.albumId.startsWith("itunes-") &&
        !known.has(e.albumId) &&
        !recoveredRef.current.has(e.albumId),
    );
    for (const e of missing) {
      recoveredRef.current.add(e.albumId);
      // In the listener's storefront, like Day Detail's own fetch, and a
      // non-empty tracklist is tagged with that store and TRACKLIST_VERSION —
      // untagged, opening the entry would refetch it as stale.
      void fetchAlbumDetail(e.albumId, { country }).then((detail) => {
        if (!detail) return;
        const fetched = albumFromDetail(detail);
        const album = mergeEntry(
          detail.tracks.length
            ? { ...fetched, tracksCountry: country, tracksVersion: TRACKLIST_VERSION }
            : fetched,
          e,
        );
        // Show it on this device now, and persist the blob (in the entry's own
        // theme) so it syncs.
        upsertMutate({ slots: [album], theme: e.theme });
      });
    }
  }, [queryData, poolById, country, upsertMutate]);

  const value = useMemo<JournalContextValue>(
    () => ({
      albums,
      allAlbums,
      albumsByDate,
      logAlbum,
      updateSlot,
      moveSlot,
      removeSlot,
      enrichSlot,
    }),
    [albums, allAlbums, albumsByDate, logAlbum, updateSlot, moveSlot, removeSlot, enrichSlot],
  );

  return <JournalContext.Provider value={value}>{children}</JournalContext.Provider>;
}

export function useJournal(): JournalContextValue {
  const ctx = useContext(JournalContext);
  if (!ctx) throw new Error("useJournal must be used within a JournalProvider");
  return ctx;
}
