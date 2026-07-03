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
  formatDisplayDate,
  parseDate,
  startOfWeek,
  type Album,
} from "@/lib/day-of-music/data";
import {
  albumFromDetail,
  albumFromSearchResult,
  albumFromTrack,
  coverFromSeed,
  fetchAlbumDetail,
  parseAppleMusicLink,
  searchMusic,
  type AlbumDetail,
} from "@/lib/day-of-music/music-search";
import { useCountry } from "@/lib/day-of-music/profile";
import { Cover } from "@/components/day-of-music/cover";
import { Button } from "@/components/day-of-music/atoms";
import { Modal } from "@/components/day-of-music/modal";

export type NewEntry = {
  /** One or more days to log this album on. The same album/rating/note is
   *  written to each date (one album per day per theme). */
  dates: string[];
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
  const initialDate = defaultDate ?? fmtDate(defaultWeekStart);
  // Days to log on. Multiple days can be selected so the same album is logged
  // across several dates at once.
  const [selectedDates, setSelectedDates] = useState<Set<string>>(
    () => new Set([initialDate]),
  );
  // The day whose week is currently shown in the picker. Independent of the
  // selection so the user can navigate weeks and pick days across them.
  const [weekAnchor, setWeekAnchor] = useState(initialDate);
  const [rating, setRating] = useState(0);
  const [note, setNote] = useState("");

  function toggleDate(k: string) {
    setSelectedDates((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  // Manual entry: log music that isn't on Apple Music (e.g. found on YouTube).
  // The user types title + artist and can add their own cover picture.
  const [manualMode, setManualMode] = useState(false);
  const [manualTitle, setManualTitle] = useState("");
  const [manualArtist, setManualArtist] = useState("");
  const [manualGenre, setManualGenre] = useState("");
  // Cover image as a (downscaled) data URL, or null for the typographic tile.
  const [manualArt, setManualArt] = useState<string | null>(null);
  // Stable id for the manual album, created once per modal open.
  const [manualId] = useState(
    () => `manual-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  );

  // Read a picked image file, downscale it to keep localStorage small, and
  // store it as a JPEG data URL (data URLs don't taint the export canvas).
  function handlePickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file later
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const src = typeof reader.result === "string" ? reader.result : "";
      if (!src) return;
      const img = new Image();
      img.onload = () => {
        const MAX = 600;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          setManualArt(src);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        setManualArt(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = () => setManualArt(src);
      img.src = src;
    };
    reader.readAsDataURL(file);
  }

  // Build a journal-ready Album from the manual fields.
  function buildManualAlbum(): Album {
    return {
      id: manualId,
      date: "", // assigned when the entry is logged
      title: manualTitle.trim(),
      titleKo: "",
      artist: manualArtist.trim() || "Unknown artist",
      genre: manualGenre.trim(),
      year: new Date().getFullYear(),
      format: "Manual",
      cover: coverFromSeed(manualId),
      artworkUrl: manualArt ?? undefined,
      kind: "album",
      note: "",
      rating: 0,
      tracks: [],
    };
  }

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
  const weekStart = useMemo(() => startOfWeek(parseDate(weekAnchor)), [weekAnchor]);
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  return (
    <Modal label="Log an album" onClose={onClose}>
      <div className="dom-addflow">
        <div className="dom-addflow-eyebrow">log an album · 새 앨범 기록</div>
        <h1 className="dom-addflow-title">Step {step} of 3</h1>

        <div className="dom-addflow-progress">
          <div
            className="dom-addflow-progress-fill"
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>

        {step === 1 && !manualMode && (
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
            <button
              type="button"
              className="dom-addflow-manual-link"
              onClick={() => setManualMode(true)}
            >
              Not on Apple Music? Add it yourself · 직접 입력
            </button>
          </div>
        )}

        {step === 1 && manualMode && (
          <div className="dom-addflow-body">
            <button
              type="button"
              className="dom-addflow-manual-back"
              onClick={() => setManualMode(false)}
            >
              ← Back to search · 검색으로
            </button>

            <label className="dom-addflow-label">Cover image · 커버 이미지 (선택)</label>
            <div className="dom-addflow-manual-cover">
              <label className="dom-addflow-imagedrop">
                {manualArt ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={manualArt} alt="Cover preview" />
                ) : (
                  <span>
                    ＋ Add a picture
                    <br />
                    사진 추가
                  </span>
                )}
                <input type="file" accept="image/*" hidden onChange={handlePickImage} />
              </label>
              {manualArt && (
                <button
                  type="button"
                  className="dom-addflow-manual-removeimg"
                  onClick={() => setManualArt(null)}
                >
                  Remove picture · 사진 제거
                </button>
              )}
            </div>

            <label className="dom-addflow-label">Title · 제목</label>
            <input
              className="dom-input"
              autoFocus
              placeholder="Song or album title"
              value={manualTitle}
              onChange={(e) => setManualTitle(e.target.value)}
            />

            <label className="dom-addflow-label" style={{ marginTop: 4 }}>
              Artist · 아티스트
            </label>
            <input
              className="dom-input"
              placeholder="Artist name"
              value={manualArtist}
              onChange={(e) => setManualArtist(e.target.value)}
            />

            <label className="dom-addflow-label" style={{ marginTop: 4 }}>
              Genre · 장르
            </label>
            <input
              className="dom-input"
              placeholder="Genre, e.g. Pop, R&B, Indie Rock"
              value={manualGenre}
              onChange={(e) => setManualGenre(e.target.value)}
            />
          </div>
        )}

        {step === 2 && (
          <div className="dom-addflow-body">
            <label className="dom-addflow-label">
              Pick one or more days · 여러 날 선택 가능
            </label>
            <div className="dom-addflow-weeknav">
              <button
                type="button"
                className="dom-addflow-weeknav-btn"
                aria-label="Previous week"
                onClick={() => setWeekAnchor(fmtDate(addDays(weekStart, -7)))}
              >
                ←
              </button>
              <span className="dom-addflow-weeknav-label">
                {formatDisplayDate(weekStart, country, "short")} – {formatDisplayDate(addDays(weekStart, 6), country, "short")}
              </span>
              <button
                type="button"
                className="dom-addflow-weeknav-btn"
                aria-label="Next week"
                onClick={() => setWeekAnchor(fmtDate(addDays(weekStart, 7)))}
              >
                →
              </button>
            </div>
            <div className="dom-addflow-datestack">
              {weekDays.map((d) => {
                const k = fmtDate(d);
                return (
                  <button
                    key={k}
                    className="dom-addflow-date"
                    data-active={selectedDates.has(k) ? "1" : "0"}
                    onClick={() => toggleDate(k)}
                  >
                    <span className="dom-addflow-date-num">{d.getDate()}</span>
                    <span className="dom-addflow-date-dow">{DOW[d.getDay()]}</span>
                  </button>
                );
              })}
            </div>
            {selectedDates.size > 0 && (
              <div className="dom-addflow-selected">
                {selectedDates.size === 1
                  ? `1 day selected · ${formatDisplayDate([...selectedDates][0], country)}`
                  : `${selectedDates.size} days selected · ${selectedDates.size}일 선택됨`}
              </div>
            )}
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
            <Button variant="ghost" onClick={() => setStep(step - 1)}>
              ← Back
            </Button>
          ) : (
            <div />
          )}
          {step < 3 ? (
            <Button
              disabled={
                (step === 1 && (manualMode ? !manualTitle.trim() || !manualGenre.trim() : !picked)) ||
                (step === 2 && selectedDates.size === 0)
              }
              onClick={() => {
                // Leaving step 1 in manual mode: turn the typed fields into the
                // picked album so steps 2–3 (and Save) work unchanged.
                if (step === 1 && manualMode) setPicked(buildManualAlbum());
                setStep(step + 1);
              }}
            >
              Continue →
            </Button>
          ) : (
            <Button
              onClick={() => {
                const dates = [...selectedDates].sort();
                if (picked && dates.length) {
                  onSave({ dates, rating, note, album: picked });
                }
                onClose();
              }}
            >
              Save entry
            </Button>
          )}
        </div>
      </div>
    </Modal>
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
