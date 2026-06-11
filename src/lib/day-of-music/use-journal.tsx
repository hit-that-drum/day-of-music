// use-journal.tsx — journal persistence layer.
// The TanStack Query cache is the single source of truth. Entries load from
// /api/journal (falling back to localStorage when no DB is configured), are
// overlaid on the static catalog, and mutations update the cache optimistically
// while writing through to localStorage and PUTting to the server.

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
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

type PatchMap = Record<string, JournalPatch>;
type JournalResponse = { entries: JournalEntry[]; persisted: boolean };

const JournalContext = createContext<JournalContextValue | null>(null);

function authHeaders(token: string | null): HeadersInit {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

type JournalContextValue = {
  albums: Album[];
  albumsByDate: Record<string, Album>;
  getAlbum: (id: string) => Album | undefined;
  logEntry: (input: { albumId: string; date: string; rating: number; note: string }) => void;
  /** Add an album outside the static catalog (e.g. a music search result) and log it. */
  addAlbum: (album: Album, entry: { date: string; rating: number; note: string }) => void;
  updateEntry: (albumId: string, patch: JournalPatch) => void;
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

async function fetchJournal(token: string | null): Promise<JournalResponse> {
  const res = await fetch("/api/journal", {
    cache: "no-store",
    headers: authHeaders(token),
  });
  const data: JournalResponse = res.ok
    ? ((await res.json()) as JournalResponse)
    : { entries: [], persisted: false };

  // Server wins when it has data; otherwise fall back to local edits.
  if (data.persisted && data.entries.length) {
    writeLocalEntries(data.entries);
    return data;
  }
  return { entries: readLocalEntries(), persisted: data.persisted };
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

function patchesFromEntries(entries: JournalEntry[]): PatchMap {
  const out: PatchMap = {};
  for (const e of entries) {
    out[e.albumId] = { date: e.date, rating: e.rating, note: e.note, mood: e.mood };
  }
  return out;
}

export function JournalProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { configured, user, accessToken } = useAuth();
  const queryKey = useMemo(() => ["journal", user?.id ?? "anon"] as const, [user?.id]);

  // Guest = auth is configured but nobody is signed in. Guests work entirely
  // in-memory (query cache only): no fetch, no localStorage, no server writes —
  // so leaving the page resets everything to the initial catalog.
  const guest = configured && !user;

  const query = useQuery({
    queryKey,
    queryFn: () => fetchJournal(accessToken),
    // In auth mode, only load once signed in; in shared mode, always.
    enabled: !configured || Boolean(user),
  });

  // User-added albums (from music search). Guests get the in-memory bucket.
  const customAlbums = useSyncExternalStore(
    subscribeCustomAlbums,
    guest ? getGuestAlbums : getCustomAlbums,
    () => EMPTY_ALBUMS,
  );

  const queryData = query.data;
  const patches = useMemo(
    () => patchesFromEntries(queryData?.entries ?? []),
    [queryData],
  );
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

  const upsert = useMutation({
    mutationFn: async (entry: JournalEntry) => {
      // Guests never write to the server (the route would reject them anyway);
      // the optimistic cache update in onMutate is their whole persistence.
      if (guest) return { persisted: false };
      const res = await fetch("/api/journal", {
        method: "PUT",
        headers: authHeaders(accessToken),
        body: JSON.stringify(entry),
      });
      if (!res.ok) throw new Error("Failed to save entry");
      return (await res.json()) as { persisted: boolean };
    },
    onMutate: (entry) => {
      const previous = queryClient.getQueryData<JournalResponse>(queryKey);
      const base = previous ?? { entries: [], persisted: false };
      const nextEntries = [
        ...base.entries.filter((e) => e.albumId !== entry.albumId),
        entry,
      ];
      queryClient.setQueryData<JournalResponse>(queryKey, {
        entries: nextEntries,
        persisted: base.persisted,
      });
      if (!guest) writeLocalEntries(nextEntries);
      return { previous };
    },
    onError: (_err, _entry, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(queryKey, ctx.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const applyPatch = useCallback(
    (albumId: string, patch: JournalPatch) => {
      const base = albumById[albumId];
      if (!base) return;
      const merged = { ...base, ...patch };
      upsert.mutate({
        albumId,
        date: merged.date,
        rating: merged.rating,
        note: merged.note,
        mood: merged.mood,
      });
    },
    [albumById, upsert],
  );

  const logEntry = useCallback<JournalContextValue["logEntry"]>(
    ({ albumId, date, rating, note }) => applyPatch(albumId, { date, rating, note }),
    [applyPatch],
  );

  const addAlbum = useCallback<JournalContextValue["addAlbum"]>(
    (album, { date, rating, note }) => {
      upsertCustomAlbum(album, !guest);
      // Bypass applyPatch: the album isn't in albumById until the store updates.
      upsert.mutate({ albumId: album.id, date, rating, note, mood: album.mood });
    },
    [upsert, guest],
  );

  const updateEntry = useCallback<JournalContextValue["updateEntry"]>(
    (albumId, patch) => applyPatch(albumId, patch),
    [applyPatch],
  );

  const value = useMemo<JournalContextValue>(
    () => ({
      albums,
      albumsByDate,
      getAlbum: (id) => albumById[id],
      logEntry,
      addAlbum,
      updateEntry,
      persisted: query.data?.persisted ?? false,
    }),
    [albums, albumsByDate, albumById, logEntry, addAlbum, updateEntry, query.data?.persisted],
  );

  return <JournalContext.Provider value={value}>{children}</JournalContext.Provider>;
}

export function useJournal(): JournalContextValue {
  const ctx = useContext(JournalContext);
  if (!ctx) throw new Error("useJournal must be used within a JournalProvider");
  return ctx;
}
