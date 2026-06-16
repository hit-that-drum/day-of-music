// add-flow.tsx — Add / Log Album: a 3-step modal (find → pick day → rate + note).
// Step 1 searches the static catalog locally and the wider music catalog via
// /api/music/search (free iTunes Search API proxy).

"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { ALBUMS, DOW, addDays, fmtDate, type Album } from "@/lib/day-of-music/data";
import {
  albumFromDetail,
  albumFromSearchResult,
  fetchAlbumDetail,
  parseAppleMusicLink,
  searchMusic,
} from "@/lib/day-of-music/music-search";
import { Cover } from "@/components/day-of-music/cover";

export type NewEntry = {
  id: string;
  date: string;
  rating: number;
  note: string;
  /** Set when the picked album is not in the static catalog (search result). */
  album?: Album;
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
  /** First day of the week the picker offers (the week being viewed). */
  weekStart: Date;
  defaultDate?: string;
};

export function AddFlow({ onClose, onSave, weekStart, defaultDate }: AddFlowProps) {
  const [step, setStep] = useState(1);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Album | null>(null);
  const [date, setDate] = useState(defaultDate ?? fmtDate(weekStart));
  const [rating, setRating] = useState(0);
  const [note, setNote] = useState("");

  const debouncedQuery = useDebounced(query.trim(), 300);

  // Compact by default (8 results); "See all" fetches a larger batch and
  // reveals it with infinite scroll. Reset whenever the query changes.
  const COMPACT_COUNT = 8;
  const ALL_LIMIT = 50;
  const PAGE = 12;
  const [showAll, setShowAll] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE);

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
    queryKey: ["music-search", debouncedQuery, limit],
    queryFn: () => searchMusic(debouncedQuery, { limit }),
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

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
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
              }}
            />
            <div className="dom-addflow-results" onScroll={handleResultsScroll}>
              {results.map((a) => (
                <button
                  key={a.id}
                  className="dom-addflow-result"
                  data-active={picked?.id === a.id ? "1" : "0"}
                  onClick={() => setPicked(a)}
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
              ))}
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
                  onSave({
                    id: picked.id,
                    date,
                    rating,
                    note,
                    // Pass the full album along when it's not in the catalog.
                    album: CATALOG_IDS.has(picked.id) ? undefined : picked,
                  });
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
