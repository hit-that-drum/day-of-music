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
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { Album } from "@/lib/day-of-music/data";
import {
  CUSTOM_ALBUMS_STORAGE_KEY,
  JOURNAL_STORAGE_KEY,
  type JournalEntry,
  type JournalPatch,
} from "@/lib/day-of-music/journal";
import { albumFromDetail, fetchAlbumDetail } from "@/lib/day-of-music/music-search";
import {
  DEFAULT_THEME_ID,
  resolveActiveTheme,
  useActiveTheme,
  useThemes,
} from "@/lib/day-of-music/themes";
import { useAuth } from "@/components/day-of-music/auth-provider";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type PatchMap = Record<string, JournalPatch>;
// Mutation variables. `optimistic: false` lets a multi-write caller (moveSlot)
// own the cache update + rollback so the per-call optimistic logic is skipped.
type UpsertVars = { album: Album; theme: string; optimistic?: boolean };
type RemoveVars = { date: string; theme: string; optimistic?: boolean };
// `albums` carries the full metadata for every logged album so a second device
// can render entries it never saw created. Built from each row's `album` blob.
type JournalResponse = { entries: JournalEntry[]; albums: Album[]; persisted: boolean };

// Row shape of public.journal_entries (snake_case).
type JournalRow = {
  album_id: string;
  date: string;
  rating: number;
  note: string;
  theme: string | null;
  album: Album | null;
};

const JournalContext = createContext<JournalContextValue | null>(null);

type JournalContextValue = {
  albums: Album[];
  allAlbums: JournalAlbum[];
  albumsByDate: Record<string, Album>;
  getByDate: (date: string) => Album | undefined;
  /** Log (or replace) the album in the active theme's slot at `date`. */
  logAlbum: (album: Album, entry: { date: string; rating: number; note: string }) => void;
  /** Update the slot at `date` while keeping the same album id/date. */
  updateSlot: (date: string, patch: Partial<Album>) => void;
  /** Move (or swap) the album between two dates within the active theme. */
  moveSlot: (fromDate: string, toDate: string) => void;
  /** Clear the slot at `date`. */
  removeSlot: (date: string) => void;
  /** Enrich the album in the slot at `date` (tracklist/release date). */
  enrichSlot: (date: string, patch: Partial<Album>) => void;
  persisted: boolean;
};

export type JournalAlbum = Album & {
  theme: string;
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
    return { entries: readLocalEntries(), albums: readCustomAlbums(), persisted: false };
  }

  const { data, error } = await supabase
    .from("journal_entries")
    .select("album_id, date, rating, note, theme, album")
    .order("date");
  if (error) throw new Error(error.message);

  const rows = data as JournalRow[];
  return {
    entries: rows.map((r) => ({
      albumId: r.album_id,
      date: r.date,
      rating: r.rating,
      note: r.note,
      theme: r.theme ?? DEFAULT_THEME_ID,
    })),
    // Older rows predate the `album` column and come back null — those albums
    // get backfilled from localStorage by the effect in JournalProvider.
    albums: rows.map((r) => r.album).filter((a): a is Album => Boolean(a)),
    persisted: true,
  };
}

function readCustomAlbums(): Album[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_ALBUMS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Album[]) : [];
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

// Tiny external store for user-added albums (from music search).
// Two buckets: a localStorage-backed one (signed-in / unconfigured shared mode)
// and an in-memory one for guests, which resets when the page is left.
// The server snapshot is empty, so hydration stays consistent and React
// re-renders with local data after mount.
const EMPTY_ALBUMS: Album[] = [];
let customAlbumsCache: Album[] | null = null;
let guestAlbums: Album[] = EMPTY_ALBUMS;
const customAlbumsListeners = new Set<() => void>();

function getCustomAlbums(): Album[] {
  if (customAlbumsCache === null) customAlbumsCache = readCustomAlbums();
  return customAlbumsCache;
}

function getGuestAlbums(): Album[] {
  return guestAlbums;
}

function subscribeCustomAlbums(listener: () => void): () => void {
  customAlbumsListeners.add(listener);
  return () => customAlbumsListeners.delete(listener);
}

function upsertCustomAlbum(album: Album, persist: boolean): void {
  if (persist) {
    customAlbumsCache = [...getCustomAlbums().filter((a) => a.id !== album.id), album];
    writeCustomAlbums(customAlbumsCache);
  } else {
    guestAlbums = [...guestAlbums.filter((a) => a.id !== album.id), album];
  }
  for (const listener of customAlbumsListeners) listener();
}

export function JournalProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { configured, user } = useAuth();
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

  // User-added albums (from music search). Guests get the in-memory bucket;
  // signed-in users get a localStorage cache for instant optimistic renders.
  const storeAlbums = useSyncExternalStore(
    subscribeCustomAlbums,
    guest ? getGuestAlbums : getCustomAlbums,
    () => EMPTY_ALBUMS,
  );

  const queryData = query.data;
  // Album metadata pool, keyed by album id (theme/date independent). Synced
  // Supabase blobs are the cross-device source of truth; the local store
  // overlays them so an album just added here shows before the refetch lands.
  const dbAlbums = queryData?.albums;
  const poolById = useMemo(() => {
    const byId = new Map<string, Album>();
    for (const a of dbAlbums ?? []) byId.set(a.id, a);
    for (const a of storeAlbums) byId.set(a.id, a);
    return byId;
  }, [dbAlbums, storeAlbums]);

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
      out[e.date] = { ...meta, date: e.date, rating: e.rating, note: e.note };
    }
    return out;
  }, [queryData, theme, poolById]);
  const albums = useMemo(() => Object.values(albumsByDate), [albumsByDate]);
  const allAlbums = useMemo<JournalAlbum[]>(() => {
    const out: JournalAlbum[] = [];
    for (const e of queryData?.entries ?? []) {
      const meta = poolById.get(e.albumId);
      if (!meta) continue;
      out.push({
        ...meta,
        date: e.date,
        rating: e.rating,
        note: e.note,
        theme: e.theme,
      });
    }
    return out;
  }, [queryData, poolById]);

  // Takes the full merged Album so the album's metadata is persisted alongside
  // its journal overlay — that metadata blob is what lets another device render
  // the entry. The journal columns (date/rating/note) are derived from it.
  const upsert = useMutation({
    mutationFn: async ({ album, theme: t }: UpsertVars) => {
      // Guests: the optimistic cache update in onMutate is their whole
      // persistence. Unconfigured: localStorage write-through in onMutate.
      const supabase = getSupabaseBrowserClient();
      if (guest || !supabase || !userId) return { persisted: false };

      const row = {
        user_id: userId,
        theme: t,
        album_id: album.id,
        date: album.date,
        rating: album.rating,
        note: album.note,
        album,
      };
      // The slot is (user_id, theme, date) — one album per day per theme.
      const { error } = await supabase
        .from("journal_entries")
        .upsert(row, { onConflict: "user_id,theme,date" });
      if (error) throw new Error(error.message);
      return { persisted: true };
    },
    onMutate: ({ album, theme: t, optimistic = true }) => {
      // moveSlot updates the cache itself (one atomic swap with a single
      // rollback), so it opts out of this per-call optimistic update.
      if (!optimistic) return { previous: undefined };
      const previous = queryClient.getQueryData<JournalResponse>(queryKey);
      const base = previous ?? { entries: [], albums: [], persisted: false };
      const entry: JournalEntry = {
        albumId: album.id,
        date: album.date,
        rating: album.rating,
        note: album.note,
        theme: t,
      };
      // Replace whatever was in this (theme, date) slot.
      const nextEntries = [
        ...base.entries.filter((e) => !(e.date === album.date && e.theme === t)),
        entry,
      ];
      // The album-metadata pool is keyed by id (theme-independent).
      const nextAlbums = [...base.albums.filter((a) => a.id !== album.id), album];
      queryClient.setQueryData<JournalResponse>(queryKey, {
        entries: nextEntries,
        albums: nextAlbums,
        persisted: base.persisted,
      });
      // localStorage write-through only in unconfigured (no-Supabase) mode.
      if (!configured) writeLocalEntries(nextEntries);
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(queryKey, ctx.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const remove = useMutation({
    mutationFn: async ({ date, theme: t }: RemoveVars) => {
      const supabase = getSupabaseBrowserClient();
      if (guest || !supabase || !userId) return { persisted: false };
      const { error } = await supabase
        .from("journal_entries")
        .delete()
        .eq("user_id", userId)
        .eq("theme", t)
        .eq("date", date);
      if (error) throw new Error(error.message);
      return { persisted: true };
    },
    onMutate: ({ date, theme: t, optimistic = true }) => {
      // moveSlot manages the cache atomically; skip the per-call update.
      if (!optimistic) return { previous: undefined };
      const previous = queryClient.getQueryData<JournalResponse>(queryKey);
      const base = previous ?? { entries: [], albums: [], persisted: false };
      // Clear just this (theme, date) slot; album metadata stays in the pool.
      const nextEntries = base.entries.filter(
        (e) => !(e.date === date && e.theme === t),
      );
      queryClient.setQueryData<JournalResponse>(queryKey, {
        entries: nextEntries,
        albums: base.albums,
        persisted: base.persisted,
      });
      if (!configured) writeLocalEntries(nextEntries);
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(queryKey, ctx.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  // Destructure the mutate functions: they're referentially stable across
  // renders, so depending on them (rather than the fresh mutation object) keeps
  // the callbacks/effect below memoized and satisfies exhaustive-deps.
  const { mutate: upsertMutate, mutateAsync: upsertAsync } = upsert;
  const { mutate: removeMutate, mutateAsync: removeAsync } = remove;

  // Log / replace the album in the (active theme, date) slot.
  const logAlbum = useCallback<JournalContextValue["logAlbum"]>(
    (album, { date, rating, note }) => {
      upsertCustomAlbum(album, !guest); // metadata pool, for instant render
      upsertMutate({ album: { ...album, date, rating, note }, theme });
    },
    [upsertMutate, guest, theme],
  );

  // Update the slot at a date (keeps the same album id + slot date).
  const updateSlot = useCallback<JournalContextValue["updateSlot"]>(
    (date, patch) => {
      const base = albumsByDate[date];
      if (!base) return;
      const merged = { ...base, ...patch, date };
      const metadataChanged = Object.keys(patch).some(
        (key) => !["date", "note", "rating"].includes(key),
      );
      if (metadataChanged) upsertCustomAlbum(merged, !guest);
      // Re-persist the whole album so its metadata blob isn't dropped.
      upsertMutate({ album: merged, theme });
    },
    [albumsByDate, guest, upsertMutate, theme],
  );

  // Move (or swap) the album between two dates within the active theme. A move
  // is two writes (or one write + one delete). Applying them as two independent
  // optimistic mutations risks a half-rolled-back board if the second write
  // fails, so the whole swap is staged in the cache once, with a single
  // snapshot, and the writes run with optimistic:false. Any rejection restores
  // that one snapshot.
  const moveSlot = useCallback<JournalContextValue["moveSlot"]>(
    (fromDate, toDate) => {
      if (fromDate === toDate) return;
      const a = albumsByDate[fromDate];
      if (!a) return;
      const b = albumsByDate[toDate];

      const previous = queryClient.getQueryData<JournalResponse>(queryKey);
      const base = previous ?? { entries: [], albums: [], persisted: false };
      // Drop both slots in this theme, then re-add them swapped.
      const kept = base.entries.filter(
        (e) => e.theme !== theme || (e.date !== fromDate && e.date !== toDate),
      );
      const swapped: JournalEntry[] = [
        ...kept,
        { albumId: a.id, date: toDate, rating: a.rating, note: a.note, theme },
      ];
      if (b) {
        swapped.push({
          albumId: b.id,
          date: fromDate,
          rating: b.rating,
          note: b.note,
          theme,
        });
      }
      queryClient.setQueryData<JournalResponse>(queryKey, { ...base, entries: swapped });
      if (!configured) writeLocalEntries(swapped);

      const writes: Promise<unknown>[] = [
        upsertAsync({ album: { ...a, date: toDate }, theme, optimistic: false }),
        b
          ? upsertAsync({ album: { ...b, date: fromDate }, theme, optimistic: false })
          : removeAsync({ date: fromDate, theme, optimistic: false }),
      ];
      Promise.all(writes)
        .catch(() => {
          if (previous) {
            queryClient.setQueryData(queryKey, previous);
            if (!configured) writeLocalEntries(previous.entries);
          }
        })
        .finally(() => queryClient.invalidateQueries({ queryKey }));
    },
    [albumsByDate, queryClient, queryKey, theme, configured, upsertAsync, removeAsync],
  );

  const enrichSlot = useCallback<JournalContextValue["enrichSlot"]>(
    (date, patch) => {
      const base = albumsByDate[date];
      // Only user-added (itunes) albums need lazy enrichment.
      if (!base || !base.id.startsWith("itunes-")) return;
      const merged = { ...base, ...patch };
      // Refresh the metadata pool (so every day using this album re-renders),
      // and re-persist this slot's row so it syncs.
      upsertCustomAlbum(merged, !guest);
      if (!guest) upsertMutate({ album: merged, theme });
    },
    [albumsByDate, guest, upsertMutate, theme],
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
  useEffect(() => {
    if (guest || !configured || !user || !queryData) return;
    const synced = new Set(queryData.albums.map((a) => a.id));
    const local = new Map(storeAlbums.map((a) => [a.id, a]));
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
      upsertMutate({
        album: { ...meta, date: e.date, rating: e.rating, note: e.note },
        theme: e.theme,
      });
    }
  }, [guest, configured, user, queryData, storeAlbums, upsertMutate]);

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
      void fetchAlbumDetail(e.albumId).then((detail) => {
        if (!detail) return;
        const album: Album = {
          ...albumFromDetail(detail),
          date: e.date,
          rating: e.rating,
          note: e.note,
        };
        // Show it on this device now, and persist the blob (in the entry's own
        // theme) so it syncs.
        upsertCustomAlbum(album, !guest);
        if (!guest) upsertMutate({ album, theme: e.theme });
      });
    }
  }, [queryData, poolById, guest, upsertMutate]);

  const value = useMemo<JournalContextValue>(
    () => ({
      albums,
      allAlbums,
      albumsByDate,
      getByDate: (date) => albumsByDate[date],
      logAlbum,
      updateSlot,
      moveSlot,
      removeSlot,
      enrichSlot,
      persisted: query.data?.persisted ?? false,
    }),
    [albums, allAlbums, albumsByDate, logAlbum, updateSlot, moveSlot, removeSlot, enrichSlot, query.data?.persisted],
  );

  return <JournalContext.Provider value={value}>{children}</JournalContext.Provider>;
}

export function useJournal(): JournalContextValue {
  const ctx = useContext(JournalContext);
  if (!ctx) throw new Error("useJournal must be used within a JournalProvider");
  return ctx;
}
