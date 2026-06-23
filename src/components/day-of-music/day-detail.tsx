// day-detail.tsx — Day Detail modal: deep-dive into one day's album.
// Tabs: Tracklist · Journal · Info. Rating updates instantly; note commits on blur.

"use client";

import { useEffect, useRef, useState } from "react";

import { DOW, formatDisplayDate, parseDate, type Album } from "@/lib/day-of-music/data";
import { fetchAlbumDetail } from "@/lib/day-of-music/music-search";
import { useCountry } from "@/lib/day-of-music/profile";
import { Cover } from "@/components/day-of-music/cover";

type Tab = "tracklist" | "journal" | "info";

type DayDetailProps = {
  album: Album;
  onClose: () => void;
  /** Update the slot at this date — rating/note, or a `date` patch to move it. */
  onUpdate: (date: string, patch: Partial<Album>) => void;
  /** Persist lazily-fetched catalog metadata (tracklist, release date). */
  onEnrich: (date: string, patch: Partial<Album>) => void;
  /** Delete the slot on this date. */
  onRemove: (date: string) => void;
  /** Swap which album is logged on this day (reopens search, keeps the date). */
  onReplace: (album: Album) => void;
};

// Deterministic track time from index so renders are stable (no hydration drift).
function trackTime(i: number, seed: number): string {
  const base = ((i * 37 + seed * 13) % 200) + 120; // 2:00–5:20-ish, seconds
  const m = Math.floor(base / 60);
  const s = base % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Release date in the listener's country notation (KR → "2024년 10월 14일",
// US → "October 14, 2024"). Falls back to the year when no full date is known.
function formatReleased(album: Album, country: string): string {
  if (!album.releaseDate) return String(album.year);
  return formatDisplayDate(album.releaseDate, country);
}

export function DayDetail({ album, onClose, onUpdate, onEnrich, onRemove, onReplace }: DayDetailProps) {
  const [tab, setTab] = useState<Tab>("tracklist");
  const [note, setNote] = useState(album.note);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);
  // Holds the "Saved ✓" auto-clear timer so we can cancel it on unmount and
  // before re-arming — otherwise setNoteSaved could fire after unmount.
  const noteSavedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const country = useCountry();
  const date = parseDate(album.date);
  const seed = album.tracks.length;
  const noteDirty = note !== album.note;

  // iTunes albums arrive from Search with no tracklist (Search returns album
  // metadata only). The first time such an album is opened, pull its tracks +
  // release date from the Lookup API — in the listener's storefront, so titles
  // come back localized — and persist them onto the album. We also re-fetch when
  // the stored tracklist was saved for a different store (e.g. old US-English
  // tracks now viewed as KR), so the same localization the Add flow shows
  // applies here too.
  useEffect(() => {
    if (!album.id.startsWith("itunes-")) return;
    const needsTracks = album.tracks.length === 0;
    const staleTracks = album.tracks.length > 0 && album.tracksCountry !== country;
    const needsDate = !album.releaseDate;
    if (!needsTracks && !staleTracks && !needsDate) return;

    let cancelled = false;
    fetchAlbumDetail(album.id, { country }).then((detail) => {
      if (cancelled || !detail) return;
      const patch: Partial<Album> = {};
      if ((needsTracks || staleTracks) && detail.tracks.length) {
        patch.tracks = detail.tracks;
        patch.tracksCountry = country;
        // Localize the album title/artist to the listener's store as well —
        // Korean when the catalog has it (the lookup sometimes romanizes the
        // title), otherwise the original. Only adopt non-empty, changed values.
        if (detail.title && detail.title !== album.title) patch.title = detail.title;
        if (detail.artist && detail.artist !== album.artist) patch.artist = detail.artist;
      }
      if (needsDate && detail.releaseDate) patch.releaseDate = detail.releaseDate;
      if (Object.keys(patch).length) onEnrich(album.date, patch);
    });
    return () => {
      cancelled = true;
    };
  }, [album.id, album.date, album.title, album.artist, album.tracks.length, album.tracksCountry, album.releaseDate, country, onEnrich]);

  // Rating commits immediately, so render straight from the album prop (single
  // source of truth) rather than mirroring it in local state that could drift.
  function commitRating(v: number) {
    onUpdate(album.date, { rating: v });
  }

  function saveNote() {
    onUpdate(album.date, { note });
    setNoteSaved(true);
    if (noteSavedTimer.current) clearTimeout(noteSavedTimer.current);
    noteSavedTimer.current = setTimeout(() => setNoteSaved(false), 1600);
  }

  useEffect(
    () => () => {
      if (noteSavedTimer.current) clearTimeout(noteSavedTimer.current);
    },
    [],
  );

  return (
    <div
      className="dom-scrim"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${album.title} detail`}
    >
      <div className="dom-detail" onClick={(e) => e.stopPropagation()}>
        <button className="dom-detail-close" onClick={onClose} aria-label="Close">
          ✕
        </button>

        <div className="dom-detail-left">
          <div className="dom-detail-cover">
            <Cover album={album} size="100%" />
          </div>
          <div className="dom-detail-datewrap">
            <div>
              <div className="dom-detail-date">{String(date.getDate()).padStart(2, "0")}</div>
              <div className="dom-detail-format">{album.format}</div>
            </div>
            <div className="dom-detail-dow">{DOW[date.getDay()]}</div>
          </div>
        </div>

        <div className="dom-detail-right">
          <span className="dom-eyebrow">
            {album.kind === "track" ? "track of the day · 오늘의 곡" : "album of the day · 오늘의 앨범"}
          </span>
          <h2 className="dom-detail-title">{album.title}</h2>
          <div className="dom-detail-artist">
            {album.artist} <span className="dom-detail-artist-ko">{album.titleKo}</span>
          </div>
          {album.kind === "track" && album.albumTitle && (
            <div className="dom-detail-from">from 〈{album.albumTitle}〉</div>
          )}

          <div className="dom-tabs">
            {(["tracklist", "journal", "info"] as Tab[]).map((t) => (
              <button
                key={t}
                className="dom-tab"
                data-active={tab === t ? "1" : "0"}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>

          {tab === "tracklist" && (
            album.tracks.length > 0 ? (
              <ol className="dom-tracklist">
                {/* Tracklist order is fixed for a given album, so the index is a stable key. */}
                {album.tracks.map((name, i) => (
                  <li key={i}>
                    <span className="dom-track-num">{String(i + 1).padStart(2, "0")}</span>
                    <span className="dom-track-name">{name}</span>
                    <span className="dom-track-time">{trackTime(i, seed)}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="dom-addflow-empty">
                {album.kind === "track"
                  ? `Single track${album.albumTitle ? ` from ${album.albumTitle}` : ""}.`
                  : album.id.startsWith("itunes-")
                    ? "Loading tracklist…"
                    : "No tracklist for this album."}
              </div>
            )
          )}

          {tab === "journal" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="dom-rate-row">
                {/* Fixed 5-star row — index is a stable key. */}
                {Array.from({ length: 5 }, (_, i) => (
                  <button
                    key={i}
                    className="dom-star"
                    data-on={i + 1 <= album.rating ? "1" : "0"}
                    onClick={() => commitRating(i + 1)}
                    aria-label={`Rate ${i + 1} stars`}
                  >
                    ★
                  </button>
                ))}
              </div>
              <label className="dom-edit-field">
                <span className="dom-edit-label">Logged on · 기록한 날</span>
                <input
                  type="date"
                  className="dom-input"
                  value={album.date}
                  onChange={(e) => e.target.value && onUpdate(album.date, { date: e.target.value })}
                />
              </label>
              <div className="dom-edit-field">
                <span className="dom-edit-label">Note · 메모</span>
                <textarea
                  className="dom-input dom-textarea"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Write a note…"
                />
                <div className="dom-note-actions">
                  {noteSaved && <span className="dom-note-saved">Saved ✓</span>}
                  <button
                    className="dom-btn dom-btn-sm"
                    onClick={saveNote}
                    disabled={!noteDirty}
                  >
                    Save note
                  </button>
                </div>
              </div>
            </div>
          )}

          {tab === "info" && (
            <div>
              <InfoRow label="Released" value={formatReleased(album, country)} />
              <InfoRow label="Genre" value={album.genre} />
              <InfoRow label="Format" value={album.format} />
              {album.kind === "track" ? (
                <>
                  <InfoRow label="Type" value="Track" />
                  {album.albumTitle && <InfoRow label="From album" value={album.albumTitle} />}
                </>
              ) : (
                <InfoRow label="Tracks" value={String(album.tracks.length)} />
              )}
              <InfoRow label="Logged on" value={formatDisplayDate(album.date, country)} />
            </div>
          )}

          <div className="dom-detail-actions">
            <button className="dom-btn dom-btn-ghost" onClick={() => onReplace(album)}>
              Replace album
            </button>
            {confirmRemove ? (
              <span className="dom-confirm">
                <span className="dom-confirm-q">Remove from this day?</span>
                <button
                  className="dom-btn dom-btn-danger"
                  // onRemove already closes the modal (handleRemove resets openAlbum).
                  onClick={() => onRemove(album.date)}
                >
                  Remove
                </button>
                <button className="dom-btn dom-btn-ghost" onClick={() => setConfirmRemove(false)}>
                  Cancel
                </button>
              </span>
            ) : (
              <button className="dom-btn dom-btn-ghost dom-btn-danger-ghost" onClick={() => setConfirmRemove(true)}>
                Remove
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="dom-info-row">
      <span className="dom-info-label">{label}</span>
      <span className="dom-info-value">{value}</span>
    </div>
  );
}
