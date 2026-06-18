// add-flow.tsx — Add / Log Album: a 3-step modal (find → pick day → rate + note).
// Step 1 searches the static catalog locally and the wider music catalog via
// /api/music/search (free iTunes Search API proxy).

"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import {
  ALBUMS,
  DOW,
  addDays,
  fmtDate,
  parseDate,
  startOfWeek,
  type Album,
} from "@/lib/day-of-music/data";
import {
  albumFromDetail,
  albumFromSearchResult,
  albumFromTrack,
  fetchAlbumDetail,
  parseAppleMusicLink,
  searchMusic,
  type AlbumDetail,
} from "@/lib/day-of-music/music-search";
import { useCountry } from "@/lib/day-of-music/profile";
import { Cover } from "@/components/day-of-music/cover";

export type NewEntry = {
  date: string;
  rating: number;
  note: string;
  /** The picked album (catalog quick-pick or music-search result). Its metadata
   *  is always carried so the journal can render and sync it — the pool isn't
   *  seeded from the static catalog. */
  album: Album;
};

const CATALOG_IDS = new Set(ALBUMS.map((a) => a.id));

function useDebounced(value: string, delayMs: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

type AddFlowProps = {
  onClose: () => void;
  onSave: (entry: NewEntry) => void;
  /** Seeds the initial selected day when no `defaultDate` is given. The picker
   *  then follows the selected day's week independently of this. */
  defaultWeekStart: Date;
  defaultDate?: string;
};

export function AddFlow({ onClose, onSave, defaultWeekStart, defaultDate }: AddFlowProps) {
  const [step, setStep] = useState(1);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Album | null>(null);
  const [date, setDate] = useState(defaultDate ?? fmtDate(defaultWeekStart));
  const [rating, setRating] = useState(0);
  const [note, setNote] = useState("");

  const debouncedQuery = useDebounced(query.trim(), 300);
  // Search the user's preferred storefront first (server falls back to the
  // common stores after it).
  const country = useCountry();

  // Compact by default (8 results); "See all" fetches a larger batch and
  // reveals it with infinite scroll. Reset whenever the query changes.
  const COMPACT_COUNT = 8;
  const ALL_LIMIT = 50;
  const PAGE = 12;
  const [showAll, setShowAll] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE);
  // Album whose tracklist is expanded for picking a single track.
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const catalogResults = useMemo(() => {
    const q = query.toLowerCase();
    return ALBUMS.filter(
      (a) => a.title.toLowerCase().includes(q) || a.artist.toLowerCase().includes(q),
    ).slice(0, 4);
  }, [query]);

  // If the query is an Apple Music album link (or bare catalog id), resolve it
  // directly via the lookup API instead of running a text search.
  const pastedLink = parseAppleMusicLink(debouncedQuery);

  const limit = showAll ? ALL_LIMIT : COMPACT_COUNT;
  const search = useQuery({
    queryKey: ["music-search", debouncedQuery, limit, country],
    queryFn: () => searchMusic(debouncedQuery, { limit, country }),
    enabled: debouncedQuery.length >= 2 && !pastedLink,
    staleTime: 5 * 60 * 1000,
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
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  // Tracklist of the expanded album, for picking a single track.
  const expanded = useQuery({
    queryKey: ["album-detail", expandedId, country],
    queryFn: () => fetchAlbumDetail(expandedId!, { country }),
    enabled: Boolean(expandedId),
    staleTime: 5 * 60 * 1000,
  });
  const expandedDetail = expandedId ? expanded.data ?? null : null;

  const allResults = useMemo(() => {
    // Pasted-link mode: a single resolved album (or nothing yet).
    if (pastedLink) {
      return urlAlbum.data ? [albumFromDetail(urlAlbum.data)] : [];
    }
    const remote = (search.data ?? [])
      .filter((r) => !CATALOG_IDS.has(r.id))
      .map(albumFromSearchResult);
    const merged = [...catalogResults, ...remote];
    const seen = new Set<string>();
    return merged.filter((a) => (seen.has(a.id) ? false : (seen.add(a.id), true)));
  }, [pastedLink, urlAlbum.data, catalogResults, search.data]);

  const results = showAll
    ? allResults.slice(0, visibleCount)
    : allResults.slice(0, COMPACT_COUNT);

  const searching =
    debouncedQuery.length >= 2 && (pastedLink ? urlAlbum.isFetching : search.isFetching);
  // A pasted link that resolved to nothing → invalid/unavailable.
  const urlNotFound = Boolean(pastedLink) && !urlAlbum.isFetching && !urlAlbum.data;
  // Offer "See all" when the compact search came back full (likely more exist).
  const canSeeAll =
    !pastedLink && !showAll && (search.data?.length ?? 0) >= COMPACT_COUNT && !searching;

  // Infinite scroll: reveal more of the already-fetched batch near the bottom.
  function handleResultsScroll(e: React.UIEvent<HTMLDivElement>) {
    if (!showAll) return;
    const el = e.currentTarget;
    if (
      el.scrollHeight - el.scrollTop - el.clientHeight < 80 &&
      visibleCount < allResults.length
    ) {
      setVisibleCount((c) => Math.min(c + PAGE, allResults.length));
    }
  }

  // Show the week containing the currently-selected day, so a day picked from
  // the month view (outside the viewed week) still appears and stays selected.
  const weekDays = useMemo(
    () => {
      const start = startOfWeek(parseDate(date));
      return Array.from({ length: 7 }, (_, i) => addDays(start, i));
    },
    [date],
  );

  return (
    <div className="dom-scrim" onClick={onClose} role="dialog" aria-modal="true" aria-label="Log an album">
      <div className="dom-addflow" onClick={(e) => e.stopPropagation()}>
        <button className="dom-detail-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <div className="dom-addflow-eyebrow">log an album · 새 앨범 기록</div>
        <h1 className="dom-addflow-title">Step {step} of 3</h1>

        <div className="dom-addflow-progress">
          <div
            className="dom-addflow-progress-fill"
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>

        {step === 1 && (
          <div className="dom-addflow-body">
            <label className="dom-addflow-label">Find an album</label>
            <input
              className="dom-input"
              autoFocus
              placeholder="Title, artist, or paste an Apple Music link…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                // New query → back to the compact list.
                setShowAll(false);
                setVisibleCount(PAGE);
                setExpandedId(null);
              }}
            />
            <div className="dom-addflow-results" onScroll={handleResultsScroll}>
              {results.map((a) => {
                const expandable = a.id.startsWith("itunes-");
                return (
                  <Fragment key={a.id}>
                    <button
                      className="dom-addflow-result"
                      data-active={picked?.id === a.id ? "1" : "0"}
                      onClick={() => {
                        setPicked(a);
                        setExpandedId(expandable ? a.id : null);
                      }}
                    >
                      <Cover album={a} size={56} />
                      <div className="dom-addflow-result-info">
                        <div className="dom-addflow-result-title">{a.title}</div>
                        <div className="dom-addflow-result-artist">
                          {a.artist} · {a.year}
                        </div>
                      </div>
                      {picked?.id === a.id && <span className="dom-addflow-check">✓</span>}
                    </button>
                    {expandedId === a.id && (
                      <TrackPanel
                        detail={expandedDetail}
                        loading={expanded.isFetching}
                        picked={picked}
                        onPick={setPicked}
                      />
                    )}
                  </Fragment>
                );
              })}
              {canSeeAll && (
                <button
                  type="button"
                  className="dom-addflow-seeall"
                  onClick={() => {
                    setShowAll(true);
                    setVisibleCount(PAGE);
                  }}
                >
                  See all results · 전체 보기
                </button>
              )}
              {showAll && search.isFetching && (
                <div className="dom-addflow-empty">Loading more…</div>
              )}
              {searching && !results.length && (
                <div className="dom-addflow-empty">
                  {pastedLink ? "Reading link…" : "Searching…"}
                </div>
              )}
              {urlNotFound && (
                <div className="dom-addflow-empty">
                  Couldn&apos;t read that link. Make sure it&apos;s an Apple Music album URL.
                </div>
              )}
              {!pastedLink && query && !searching && !results.length && (
                <div className="dom-addflow-empty">No matches. Try a different query.</div>
              )}
              {search.isError && (
                <div className="dom-addflow-empty">
                  Catalog search is unavailable right now.
                </div>
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="dom-addflow-body">
            <label className="dom-addflow-label">Pick a day</label>
            <div className="dom-addflow-datestack">
              {weekDays.map((d) => {
                const k = fmtDate(d);
                return (
                  <button
                    key={k}
                    className="dom-addflow-date"
                    data-active={date === k ? "1" : "0"}
                    onClick={() => setDate(k)}
                  >
                    <span className="dom-addflow-date-num">{d.getDate()}</span>
                    <span className="dom-addflow-date-dow">{DOW[d.getDay()]}</span>
                  </button>
                );
              })}
            </div>
            {picked && (
              <div className="dom-addflow-preview">
                <Cover album={picked} size={88} />
                <div>
                  <div className="dom-addflow-preview-title">{picked.title}</div>
                  <div className="dom-addflow-preview-artist">{picked.artist}</div>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="dom-addflow-body">
            <label className="dom-addflow-label">Your rating</label>
            <div className="dom-rating-input">
              {[1, 2, 3, 4, 5].map((i) => (
                <button key={i} onClick={() => setRating(i)} aria-label={`${i} stars`}>
                  <span style={{ color: i <= rating ? "var(--ink)" : "var(--lineSoft)" }}>★</span>
                </button>
              ))}
            </div>
            <label className="dom-addflow-label" style={{ marginTop: 14 }}>
              Note · 메모
            </label>
            <textarea
              className="dom-input dom-textarea"
              rows={4}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="A line you'll want to remember…"
            />
          </div>
        )}

        <div className="dom-addflow-actions">
          {step > 1 ? (
            <button className="dom-btn dom-btn-ghost" onClick={() => setStep(step - 1)}>
              ← Back
            </button>
          ) : (
            <div />
          )}
          {step < 3 ? (
            <button
              className="dom-btn"
              disabled={step === 1 && !picked}
              onClick={() => setStep(step + 1)}
            >
              Continue →
            </button>
          ) : (
            <button
              className="dom-btn"
              onClick={() => {
                if (picked) {
                  onSave({ date, rating, note, album: picked });
                }
                onClose();
              }}
            >
              Save entry
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// The expandable tracklist under a search result. Lets the user log the whole
// album or pick a single track. Rendered only while a result is expanded.
function TrackPanel({
  detail,
  loading,
  picked,
  onPick,
}: {
  detail: AlbumDetail | null;
  loading: boolean;
  picked: Album | null;
  onPick: (album: Album) => void;
}) {
  // Bail before `detail` resolves — this also narrows it for albumFromTrack
  // below, so no non-null assertion is needed.
  if (!detail) {
    return (
      <div className="dom-addflow-tracks">
        <div className="dom-addflow-tracks-label">
          Log the album, or pick a track · 트랙 선택
        </div>
        <div className="dom-addflow-empty">
          {loading ? "Loading tracks…" : "Couldn't load this album's tracks."}
        </div>
      </div>
    );
  }

  return (
    <div className="dom-addflow-tracks">
      <div className="dom-addflow-tracks-label">
        Log the album, or pick a track · 트랙 선택
      </div>
      {detail.trackItems.length > 0 ? (
        detail.trackItems.map((t) => {
          // Build the track album once so the compared id and the picked id
          // always match — the resolved detail's collection id may differ from
          // the row's id (the route falls back to an edition with tracks).
          const trackAlbum = albumFromTrack(detail, t);
          return (
            <button
              key={t.trackId}
              className="dom-addflow-track"
              data-active={picked?.id === trackAlbum.id ? "1" : "0"}
              onClick={() => onPick(trackAlbum)}
            >
              <span className="dom-addflow-track-name">{t.name}</span>
              <span className="dom-addflow-track-artist">{t.artist}</span>
              {picked?.id === trackAlbum.id && (
                <span className="dom-addflow-check">✓</span>
              )}
            </button>
          );
        })
      ) : (
        <div className="dom-addflow-empty">
          Couldn&apos;t load this album&apos;s tracks.
        </div>
      )}
    </div>
  );
}
