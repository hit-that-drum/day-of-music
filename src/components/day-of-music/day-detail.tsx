// day-detail.tsx — Day Detail modal: deep-dive into one day's album.
// Tabs: Tracklist · Journal · Info. Rating updates instantly; note commits on blur.

"use client";

import { useEffect, useRef, useState } from "react";

import { DOW, parseDate, type Album } from "@/lib/day-of-music/data";
import { Cover } from "@/components/day-of-music/cover";

type Tab = "tracklist" | "journal" | "info";

type DayDetailProps = {
  album: Album;
  onClose: () => void;
  onUpdate: (id: string, patch: Partial<Album>) => void;
  /** Delete this entry from the day. */
  onRemove: (id: string) => void;
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

export function DayDetail({ album, onClose, onUpdate, onRemove, onReplace }: DayDetailProps) {
  const [tab, setTab] = useState<Tab>("tracklist");
  const [note, setNote] = useState(album.note);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);
  // Holds the "Saved ✓" auto-clear timer so we can cancel it on unmount and
  // before re-arming — otherwise setNoteSaved could fire after unmount.
  const noteSavedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const date = parseDate(album.date);
  const seed = album.tracks.length;
  const noteDirty = note !== album.note;

  // Rating commits immediately, so render straight from the album prop (single
  // source of truth) rather than mirroring it in local state that could drift.
  function commitRating(v: number) {
    onUpdate(album.id, { rating: v });
  }

  function saveNote() {
    onUpdate(album.id, { note });
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
          <span className="dom-eyebrow">album of the day · 오늘의 앨범</span>
          <h2 className="dom-detail-title">{album.title}</h2>
          <div className="dom-detail-artist">
            {album.artist} <span className="dom-detail-artist-ko">{album.titleKo}</span>
          </div>

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
              <div className="dom-rail-mood">
                {album.mood.map((m) => (
                  <span key={m} className="dom-mood-chip">
                    {m}
                  </span>
                ))}
              </div>
              <label className="dom-edit-field">
                <span className="dom-edit-label">Logged on · 기록한 날</span>
                <input
                  type="date"
                  className="dom-input"
                  value={album.date}
                  onChange={(e) => e.target.value && onUpdate(album.id, { date: e.target.value })}
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
              <InfoRow label="Released" value={String(album.year)} />
              <InfoRow label="Genre" value={album.genre} />
              <InfoRow label="Format" value={album.format} />
              <InfoRow label="Tracks" value={String(album.tracks.length)} />
              <InfoRow label="Logged on" value={album.date} />
              <InfoRow label="Mood" value={album.mood.join(", ")} />
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
                  onClick={() => onRemove(album.id)}
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
