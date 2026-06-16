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
  indexByDate,
  mergeAlbums,
  type JournalEntry,
  type JournalPatch,
} from "@/lib/day-of-music/journal";
import { useAuth } from "@/components/day-of-music/auth-provider";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type PatchMap = Record<string, JournalPatch>;
// `albums` carries the full metadata for every logged album so a second device
// can render entries it never saw created. Built from each row's `album` blob.
type JournalResponse = { entries: JournalEntry[]; albums: Album[]; persisted: boolean };

// Row shape of public.journal_entries (snake_case).
type JournalRow = {
  album_id: string;
  date: string;
  rating: number;
  note: string;
  mood: string[];
  album: Album | null;
};

const JournalContext = createContext<JournalContextValue | null>(null);

type JournalContextValue = {
  albums: Album[];
  albumsByDate: Record<string, Album>;
  getAlbum: (id: string) => Album | undefined;
  logEntry: (input: { albumId: string; date: string; rating: number; note: string }) => void;
  /** Add an album outside the static catalog (e.g. a music search result) and log it. */
  addAlbum: (album: Album, entry: { date: string; rating: number; note: string }) => void;
  updateEntry: (albumId: string, patch: JournalPatch) => void;
  /** Enrich a user-added album in place with extra catalog metadata (e.g. the
   *  tracklist + release date fetched lazily from the iTunes Lookup API). */
  enrichAlbum: (albumId: string, patch: Partial<Album>) => void;
  /** Remove an album's journal entry (and the album itself if user-added). */
  removeEntry: (albumId: string) => void;
  persisted: boolean;
};

function readLocalEntries(): JournalEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(JOURNAL_STORAGE_KEY);
    if (!raw) return [];
    const map = JSON.parse(raw) as PatchMap;
    return Object.entries(map).map(([albumId, p]) => ({
      albumId,
      date: p.date ?? "",
      rating: p.rating ?? 0,
      note: p.note ?? "",
      mood: p.mood ?? [],
    }));
  } catch {
    return [];
  }
}

function writeLocalEntries(entries: JournalEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    const map: PatchMap = {};
    for (const e of entries) {
      map[e.albumId] = { date: e.date, rating: e.rating, note: e.note, mood: e.mood };
    }
    window.localStorage.setItem(JOURNAL_STORAGE_KEY, JSON.stringify(map));
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
    .select("album_id, date, rating, note, mood, album")
    .order("date");
  if (error) throw new Error(error.message);

  const rows = data as JournalRow[];
  return {
    entries: rows.map((r) => ({
      albumId: r.album_id,
      date: r.date,
      rating: r.rating,
      note: r.note,
      mood: r.mood ?? [],
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

function removeCustomAlbum(albumId: string, persist: boolean): void {
  if (persist) {
    customAlbumsCache = getCustomAlbums().filter((a) => a.id !== albumId);
    writeCustomAlbums(customAlbumsCache);
  } else {
    guestAlbums = guestAlbums.filter((a) => a.id !== albumId);
  }
  for (const listener of customAlbumsListeners) listener();
}

function patchesFromEntries(entries: JournalEntry[]): PatchMap {
  const out: PatchMap = {};
  for (const e of entries) {
    out[e.albumId] = { date: e.date, rating: e.rating, note: e.note, mood: e.mood };
  }
  return out;
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
  const patches = useMemo(
    () => patchesFromEntries(queryData?.entries ?? []),
    [queryData],
  );
  // The synced metadata from Supabase is the cross-device source of truth; the
  // local store overlays it so an album just added on this device shows before
  // the refetch lands (and DB albums fill in entries this device never saw).
  const dbAlbums = queryData?.albums;
  const customAlbums = useMemo(() => {
    const byId = new Map<string, Album>();
    for (const a of dbAlbums ?? []) byId.set(a.id, a);
    for (const a of storeAlbums) byId.set(a.id, a);
    return [...byId.values()];
  }, [dbAlbums, storeAlbums]);
  const albums = useMemo(
    () => mergeAlbums(patches, customAlbums),
    [patches, customAlbums],
  );
  const albumsByDate = useMemo(() => indexByDate(albums), [albums]);
  const albumById = useMemo(() => {
    const map: Record<string, Album> = {};
    for (const a of albums) map[a.id] = a;
    return map;
  }, [albums]);

  // Takes the full merged Album so the album's metadata is persisted alongside
  // its journal overlay — that metadata blob is what lets another device render
  // the entry. The journal columns (date/rating/note/mood) are derived from it.
  const upsert = useMutation({
    mutationFn: async (album: Album) => {
      // Guests: the optimistic cache update in onMutate is their whole
      // persistence. Unconfigured: localStorage write-through in onMutate.
      const supabase = getSupabaseBrowserClient();
      if (guest || !supabase || !userId) return { persisted: false };

      const row = {
        user_id: userId,
        album_id: album.id,
        date: album.date,
        rating: album.rating,
        note: album.note,
        mood: album.mood,
        album,
      };
      const { error } = await supabase
        .from("journal_entries")
        .upsert(row, { onConflict: "user_id,album_id" });
      if (error) throw new Error(error.message);
      return { persisted: true };
    },
    onMutate: (album) => {
      const previous = queryClient.getQueryData<JournalResponse>(queryKey);
      const base = previous ?? { entries: [], albums: [], persisted: false };
      const entry: JournalEntry = {
        albumId: album.id,
        date: album.date,
        rating: album.rating,
        note: album.note,
        mood: album.mood,
      };
      const nextEntries = [
        ...base.entries.filter((e) => e.albumId !== album.id),
        entry,
      ];
      const nextAlbums = [
        ...base.albums.filter((a) => a.id !== album.id),
        album,
      ];
      queryClient.setQueryData<JournalResponse>(queryKey, {
        entries: nextEntries,
        albums: nextAlbums,
        persisted: base.persisted,
      });
      // localStorage write-through only in unconfigured (no-Supabase) mode.
      if (!configured) writeLocalEntries(nextEntries);
      return { previous };
    },
    onError: (_err, _album, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(queryKey, ctx.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const remove = useMutation({
    mutationFn: async (albumId: string) => {
      const supabase = getSupabaseBrowserClient();
      if (guest || !supabase || !userId) return { persisted: false };
      const { error } = await supabase
        .from("journal_entries")
        .delete()
        .eq("user_id", userId)
        .eq("album_id", albumId);
      if (error) throw new Error(error.message);
      return { persisted: true };
    },
    onMutate: (albumId) => {
      const previous = queryClient.getQueryData<JournalResponse>(queryKey);
      const base = previous ?? { entries: [], albums: [], persisted: false };
      const nextEntries = base.entries.filter((e) => e.albumId !== albumId);
      queryClient.setQueryData<JournalResponse>(queryKey, {
        entries: nextEntries,
        albums: base.albums.filter((a) => a.id !== albumId),
        persisted: base.persisted,
      });
      if (!configured) writeLocalEntries(nextEntries);
      return { previous };
    },
    onError: (_err, _albumId, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(queryKey, ctx.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  // Destructure the mutate functions: they're referentially stable across
  // renders, so depending on them (rather than the fresh mutation object) keeps
  // the callbacks/effect below memoized and satisfies exhaustive-deps.
  const { mutate: upsertMutate } = upsert;
  const { mutate: removeMutate } = remove;

  const applyPatch = useCallback(
    (albumId: string, patch: JournalPatch) => {
      const base = albumById[albumId];
      if (!base) return;
      // Pass the whole merged album so its metadata is re-persisted with the
      // overlay change — never just the journal fields, or the upsert would
      // overwrite the row's metadata blob with null.
      upsertMutate({ ...base, ...patch });
    },
    [albumById, upsertMutate],
  );

  const logEntry = useCallback<JournalContextValue["logEntry"]>(
    ({ albumId, date, rating, note }) => applyPatch(albumId, { date, rating, note }),
    [applyPatch],
  );

  const addAlbum = useCallback<JournalContextValue["addAlbum"]>(
    (album, { date, rating, note }) => {
      upsertCustomAlbum(album, !guest);
      // Bypass applyPatch: the album isn't in albumById until the store updates.
      // mood is spelled out (not just relied on via the spread) so the journal
      // overlay always has an explicit array.
      upsertMutate({ ...album, date, rating, note, mood: album.mood ?? [] });
    },
    [upsertMutate, guest],
  );

  const updateEntry = useCallback<JournalContextValue["updateEntry"]>(
    (albumId, patch) => applyPatch(albumId, patch),
    [applyPatch],
  );

  const enrichAlbum = useCallback<JournalContextValue["enrichAlbum"]>(
    (albumId, patch) => {
      // Only user-added albums live in the mutable custom-album store; catalog
      // albums already ship with their tracklist and need no enrichment.
      const base = albumById[albumId];
      if (!base || !albumId.startsWith("itunes-")) return;
      const merged = { ...base, ...patch };
      // Intentional double update: upsertCustomAlbum refreshes the local store
      // (storeAlbums → customAlbums → albums re-render) for an instant view, and
      // the upsert re-persists the enriched metadata to the row so it syncs too.
      upsertCustomAlbum(merged, !guest);
      if (!guest) upsertMutate(merged);
    },
    [albumById, guest, upsertMutate],
  );

  const removeEntry = useCallback<JournalContextValue["removeEntry"]>(
    (albumId) => {
      removeMutate(albumId);
      // If it was a user-added album, drop it from the custom store too so it
      // disappears entirely rather than reverting to a catalog default.
      removeCustomAlbum(albumId, !guest);
    },
    [removeMutate, guest],
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
        ...meta,
        date: e.date,
        rating: e.rating,
        note: e.note,
        mood: e.mood,
      });
    }
  }, [guest, configured, user, queryData, storeAlbums, upsertMutate]);

  const value = useMemo<JournalContextValue>(
    () => ({
      albums,
      albumsByDate,
      getAlbum: (id) => albumById[id],
      logEntry,
      addAlbum,
      updateEntry,
      enrichAlbum,
      removeEntry,
      persisted: query.data?.persisted ?? false,
    }),
    [albums, albumsByDate, albumById, logEntry, addAlbum, updateEntry, enrichAlbum, removeEntry, query.data?.persisted],
  );

  return <JournalContext.Provider value={value}>{children}</JournalContext.Provider>;
}

export function useJournal(): JournalContextValue {
  const ctx = useContext(JournalContext);
  if (!ctx) throw new Error("useJournal must be used within a JournalProvider");
  return ctx;
}
