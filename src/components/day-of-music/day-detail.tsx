// day-detail.tsx — Day Detail modal: deep-dive into one day's album.
// Tabs: Tracklist · Journal · Info. Rating updates instantly; note commits on blur.

"use client";

import { useState } from "react";

import { DOW, parseDate, type Album } from "@/lib/day-of-music/data";
import { Cover } from "@/components/day-of-music/cover";

type Tab = "tracklist" | "journal" | "info";

type DayDetailProps = {
  album: Album;
  onClose: () => void;
  onUpdate: (id: string, patch: Partial<Album>) => void;
};

// Deterministic track time from index so renders are stable (no hydration drift).
function trackTime(i: number, seed: number): string {
  const base = ((i * 37 + seed * 13) % 200) + 120; // 2:00–5:20-ish, seconds
  const m = Math.floor(base / 60);
  const s = base % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function DayDetail({ album, onClose, onUpdate }: DayDetailProps) {
  const [tab, setTab] = useState<Tab>("tracklist");
  const [note, setNote] = useState(album.note);
  const [rating, setRating] = useState(album.rating);

  const date = parseDate(album.date);
  const seed = album.tracks.length;

  function setRatingAndCommit(v: number) {
    setRating(v);
    onUpdate(album.id, { rating: v });
  }

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
                {Array.from({ length: 5 }, (_, i) => (
                  <button
                    key={i}
                    className="dom-star"
                    data-on={i + 1 <= rating ? "1" : "0"}
                    onClick={() => setRatingAndCommit(i + 1)}
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
              <textarea
                className="dom-input dom-textarea"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onBlur={() => onUpdate(album.id, { note })}
                placeholder="Write a note…"
              />
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
