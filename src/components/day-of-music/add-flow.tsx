// add-flow.tsx — Add / Log Album: a 3-step modal (find → pick day → rate + note).
// Step 1 searches the static catalog locally and the wider music catalog via
// /api/music/search (free iTunes Search API proxy).

"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { ALBUMS, DOW, addDays, fmtDate, type Album } from "@/lib/day-of-music/data";
import {
  albumFromSearchResult,
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

  const catalogResults = useMemo(() => {
    const q = query.toLowerCase();
    return ALBUMS.filter(
      (a) => a.title.toLowerCase().includes(q) || a.artist.toLowerCase().includes(q),
    ).slice(0, 4);
  }, [query]);

  const search = useQuery({
    queryKey: ["music-search", debouncedQuery],
    queryFn: () => searchMusic(debouncedQuery, { limit: 8 }),
    enabled: debouncedQuery.length >= 2,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const results = useMemo(() => {
    const remote = (search.data ?? [])
      .filter((r) => !CATALOG_IDS.has(r.id))
      .map(albumFromSearchResult);
    const merged = [...catalogResults, ...remote];
    const seen = new Set<string>();
    return merged.filter((a) => (seen.has(a.id) ? false : (seen.add(a.id), true))).slice(0, 8);
  }, [catalogResults, search.data]);

  const searching = debouncedQuery.length >= 2 && search.isFetching;

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
              placeholder="Title or artist…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="dom-addflow-results">
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
              {searching && !results.length && (
                <div className="dom-addflow-empty">Searching…</div>
              )}
              {query && !searching && !results.length && (
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
