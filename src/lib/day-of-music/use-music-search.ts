// use-music-search.ts — step 1 of the Add flow: a debounced catalog search
// through /api/music/search, or a pasted Apple Music link resolved through
// /api/music/album, plus the "See all" paging and the one result whose
// tracklist is expanded for picking a single track. A new query resets both.

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import type { Album } from "@/lib/day-of-music/data";
import {
  albumFromDetail,
  albumFromSearchResult,
  fetchAlbumDetail,
  parseAppleMusicLink,
  searchMusic,
  type AlbumDetail,
} from "@/lib/day-of-music/music-search";

// Compact by default (8 results); "See all" fetches a larger batch and reveals
// it PAGE results at a time as the list scrolls.
const COMPACT_COUNT = 8;
const ALL_LIMIT = 50;
const PAGE = 12;
// Catalog answers barely change within a session; refetching them only spends
// the iTunes rate limit.
const MUSIC_STALE_TIME = 5 * 60 * 1000;

function useDebounced(value: string, delayMs: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

export type MusicSearch = {
  query: string;
  /** A new query goes back to the compact list with nothing expanded. */
  setQuery: (query: string) => void;
  /** The results to show: the visible slice of the search, or the album a
   *  pasted link resolved to. */
  results: Album[];
  /** The query is an Apple Music link (or bare catalog id), not a search. */
  pastedLink: boolean;
  searching: boolean;
  /** "See all" is fetching its larger batch. */
  loadingMore: boolean;
  /** A pasted link that resolved to nothing: invalid or unavailable. */
  linkNotFound: boolean;
  noMatches: boolean;
  searchFailed: boolean;
  /** The compact search came back full, so more likely exist. */
  canSeeAll: boolean;
  seeAll: () => void;
  /** Reveal the next page of the fetched batch (infinite scroll). */
  showMore: () => void;
  expandedId: string | null;
  setExpandedId: (id: string | null) => void;
  /** The expanded album's tracklist once it loads (null while loading or when
   *  it couldn't be fetched). */
  expandedDetail: AlbumDetail | null;
  expandedLoading: boolean;
};

/** Search the listener's storefront (`country`) first; the route falls back
 *  to the common stores after it. */
export function useMusicSearch(country: string): MusicSearch {
  const [query, setQueryState] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const debouncedQuery = useDebounced(query.trim(), 300);
  // If the query is an Apple Music album link (or bare catalog id), resolve it
  // directly via the lookup API instead of running a text search.
  const pastedLink = parseAppleMusicLink(debouncedQuery);

  const limit = showAll ? ALL_LIMIT : COMPACT_COUNT;
  const search = useQuery({
    queryKey: ["music-search", debouncedQuery, limit, country],
    queryFn: () => searchMusic(debouncedQuery, { limit, country }),
    enabled: debouncedQuery.length >= 2 && !pastedLink,
    staleTime: MUSIC_STALE_TIME,
    retry: 1,
    // Keep the current results visible while a larger batch loads.
    placeholderData: (prev) => prev,
  });

  const urlAlbum = useQuery({
    // Look the album up in the storefront the link points at (e.g. KR), since
    // an album may not exist in the default US store.
    queryKey: ["music-url", pastedLink?.id, pastedLink?.country],
    queryFn: () => fetchAlbumDetail(pastedLink!.id, { country: pastedLink!.country }),
    enabled: Boolean(pastedLink),
    staleTime: MUSIC_STALE_TIME,
    // No retry: fetchAlbumDetail resolves null on failure instead of throwing.
  });

  // Tracklist of the expanded album, for picking a single track.
  const expanded = useQuery({
    queryKey: ["album-detail", expandedId, country],
    queryFn: () => fetchAlbumDetail(expandedId!, { country }),
    enabled: Boolean(expandedId),
    staleTime: MUSIC_STALE_TIME,
  });

  const allResults = useMemo(() => {
    // Pasted-link mode: a single resolved album (or nothing yet).
    if (pastedLink) {
      return urlAlbum.data ? [albumFromDetail(urlAlbum.data)] : [];
    }
    // First of any repeated id only — results are keyed by id.
    const seen = new Set<string>();
    return (search.data ?? [])
      .map(albumFromSearchResult)
      .filter((a) => (seen.has(a.id) ? false : (seen.add(a.id), true)));
  }, [pastedLink, urlAlbum.data, search.data]);

  const results = showAll
    ? allResults.slice(0, visibleCount)
    : allResults.slice(0, COMPACT_COUNT);

  const searching =
    debouncedQuery.length >= 2 && (pastedLink ? urlAlbum.isFetching : search.isFetching);

  return {
    query,
    setQuery: (next) => {
      setQueryState(next);
      setShowAll(false);
      setVisibleCount(PAGE);
      setExpandedId(null);
    },
    results,
    pastedLink: Boolean(pastedLink),
    searching,
    loadingMore: showAll && search.isFetching,
    linkNotFound: Boolean(pastedLink) && !urlAlbum.isFetching && !urlAlbum.data,
    noMatches: !pastedLink && Boolean(query) && !searching && !results.length,
    searchFailed: search.isError,
    canSeeAll:
      !pastedLink && !showAll && (search.data?.length ?? 0) >= COMPACT_COUNT && !searching,
    seeAll: () => {
      setShowAll(true);
      setVisibleCount(PAGE);
    },
    showMore: () => {
      if (showAll && visibleCount < allResults.length) {
        setVisibleCount((c) => Math.min(c + PAGE, allResults.length));
      }
    },
    expandedId,
    setExpandedId,
    expandedDetail: expandedId ? (expanded.data ?? null) : null,
    expandedLoading: expanded.isFetching,
  };
}
