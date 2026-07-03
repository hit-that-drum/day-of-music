// stats-share-card.tsx — Share Card: a shareable poster of recap stats.
// StatsPoster is the poster body itself — the year flavor shows it inside the
// usual share chrome (scrim / poster / Copy link + Save image, like Share Week
// and Share Month), while the theme recap modal renders it off-screen and
// exports it straight to a PNG (no second modal).

"use client";

import { useRef, type Ref } from "react";

import { type AlbumStats } from "@/lib/day-of-music/album-stats";
import { DEFAULT_USERNAME, useProfile } from "@/lib/day-of-music/profile";
import { type JournalAlbum } from "@/lib/day-of-music/use-journal";
import {
  copyCurrentLink,
  saveCardAsImage,
  shareFileName,
} from "@/lib/day-of-music/save-card";
import { Cover } from "@/components/day-of-music/cover";
import { Button, Stars } from "@/components/day-of-music/atoms";
import { Modal } from "@/components/day-of-music/modal";

type StatsPosterProps = {
  /** Poster headline, e.g. "2026 · Year in Music" or the theme's name. */
  title: string;
  /** Meta chip next to @username, e.g. "🎧 Daily" or "1 theme lane". */
  themeLabel: string;
  /** Line under the albums count, e.g. "across 1 theme lane · 183 days". */
  sub: string;
  stats: AlbumStats<JournalAlbum>;
  /** Theme cards list their five-star albums; the year card stays stats-only. */
  showFives?: boolean;
  ref?: Ref<HTMLDivElement>;
};

export function StatsPoster({
  title,
  themeLabel,
  sub,
  stats,
  showFives = false,
  ref,
}: StatsPosterProps) {
  const { username } = useProfile();
  // Every five-star album goes on the poster — the card just grows taller and
  // the export captures the full node, not the viewport.
  const fives = showFives ? stats.fives : [];

  return (
    <div className="dom-share-card dom-share-card-stats" ref={ref}>
      <div className="dom-share-hd">
        <div>
          <div className="dom-share-eyebrow">DAY · OF · MUSIC</div>
          <div className="dom-share-title">{title}</div>
        </div>
        <div className="dom-share-meta">
          <span className="dom-share-user">
            @{username.trim() || DEFAULT_USERNAME}
          </span>
          <span className="dom-share-theme">{themeLabel}</span>
        </div>
      </div>

      {/* Stats — identical card markup/classes to the My Logs recap. */}
      <div className="dom-theme-recap-grid">
        <div className="dom-stat dom-stat-compact">
          <div className="dom-stat-label">albums</div>
          <div className="dom-stat-num">
            {String(stats.total).padStart(2, "0")}
          </div>
          <div className="dom-stat-sub">{sub}</div>
        </div>
        <div className="dom-stat dom-stat-compact">
          <div className="dom-stat-label">average</div>
          <div className="dom-stat-num">{stats.avgRating}</div>
          <div className="dom-stat-sub">
            <Stars value={Math.round(stats.avgRatingNum)} size={13} />
          </div>
        </div>
        <div className="dom-stat dom-stat-compact">
          <div className="dom-stat-label">five-stars</div>
          <div className="dom-stat-num">{stats.fives.length}</div>
          <div className="dom-stat-sub">
            {stats.total
              ? Math.round((stats.fives.length / stats.total) * 100)
              : 0}
            % of catalog
          </div>
        </div>
        <div className="dom-stat dom-stat-compact dom-theme-genre-card">
          <div className="dom-stat-label">top genres</div>
          <div className="dom-bars">
            {stats.topTenGenres.length ? (
              stats.topTenGenres.slice(0, 5).map(([g, n]) => (
                <div key={g} className="dom-bar">
                  <span className="dom-bar-label">{g}</span>
                  <div className="dom-bar-track">
                    <div
                      className="dom-bar-fill"
                      style={{ width: `${(n / stats.total) * 100}%` }}
                    />
                  </div>
                  <span className="dom-bar-num">{n}</span>
                </div>
              ))
            ) : (
              <div className="dom-stat-empty">No genres logged yet.</div>
            )}
          </div>
        </div>
      </div>

      {fives.length > 0 && (
        <div className="dom-share-fives">
          <div className="dom-theme-fives-title">Five stars · 다섯별 앨범</div>
          {/* Same item markup as the recap modal's fives list, so each
              album carries its info (title · artist) on the poster too. */}
          <div className="dom-fives dom-fives-compact">
            {fives.map((a) => (
              <div
                key={`${a.theme}:${a.date}:${a.id}`}
                className="dom-fives-item"
              >
                <div>
                  <Cover album={a} size="100%" />
                </div>
                <div className="dom-fives-info">
                  <div className="dom-fives-title">{a.title}</div>
                  <div className="dom-fives-artist">{a.artist}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="dom-share-ft">
        <div>
          {stats.total} albums · {stats.genreCount} genres
        </div>
        <div className="dom-day-album-rating">
          <span>★</span>
          {stats.total ? stats.avgRatingNum.toFixed(1) : "—"}
        </div>
      </div>
    </div>
  );
}

export function StatsShareCard({
  filenameParts,
  onClose,
  ...posterProps
}: Omit<StatsPosterProps, "ref"> & {
  filenameParts: (string | number)[];
  onClose: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);

  function handleSaveImage() {
    if (!cardRef.current) return;
    void saveCardAsImage(cardRef.current, shareFileName(filenameParts));
  }

  return (
    <Modal label="SHARE CARD" onClose={onClose} className="dom-share">
      <StatsPoster {...posterProps} ref={cardRef} />
      <div className="dom-share-actions">
        <Button variant="ghost" onClick={() => void copyCurrentLink()}>
          Copy link
        </Button>
        <Button onClick={handleSaveImage}>Save image</Button>
      </div>
    </Modal>
  );
}
