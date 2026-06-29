// profile-stats.tsx — Profile / Year in Listening: a wrapped-style recap.

"use client";

import type { Album } from "@/lib/day-of-music/data";
import { useJournal } from "@/lib/day-of-music/use-journal";
import { Cover } from "@/components/day-of-music/cover";
import { Stars } from "@/components/day-of-music/atoms";

export function ProfileStats({ onOpen }: { onOpen: (album: Album) => void }) {
  const { albums } = useJournal();
  const total = albums.length;
  // Keep the numeric mean around so we don't parseFloat the display string back.
  const avgRatingNum = total
    ? albums.reduce((s, a) => s + a.rating, 0) / total
    : 0;
  const avgRating = total ? avgRatingNum.toFixed(2) : "—";

  const byGenre: Record<string, number> = {};
  albums.forEach((a) => {
    byGenre[a.genre] = (byGenre[a.genre] ?? 0) + 1;
  });
  const topTenGenres = Object.entries(byGenre).sort((a, b) => b[1] - a[1]).slice(0, 10);

  const fives = albums.filter((a) => a.rating === 5);

  return (
    <div className="dom-profile">
      <div className="dom-week-hd">
        <div className="dom-week-title">
          <span className="dom-eyebrow">올해의 청음 · 2026 in listening</span>
          <h1>My Year in Music</h1>
        </div>
        <div className="dom-week-actions">
          <button className="dom-btn dom-btn-ghost">Export</button>
          <button className="dom-btn">Share card</button>
        </div>
      </div>

      <div className="dom-stats-grid">
        <div className="dom-stat dom-stat-lg">
          <div className="dom-stat-label">albums logged</div>
          <div className="dom-stat-num">{String(total).padStart(2, "0")}</div>
          <div className="dom-stat-sub">
            across {Object.keys(byGenre).length} genres · 14 days
          </div>
        </div>
        <div className="dom-stat">
          <div className="dom-stat-label">average rating</div>
          <div className="dom-stat-num">{avgRating}</div>
          <div className="dom-stat-sub">
            <Stars value={Math.round(avgRatingNum)} size={14} />
          </div>
        </div>
        <div className="dom-stat">
          <div className="dom-stat-label">five-star picks</div>
          <div className="dom-stat-num">{fives.length}</div>
          <div className="dom-stat-sub">
            {total ? Math.round((fives.length / total) * 100) : 0}% of catalog
          </div>
        </div>
        <div className="dom-stat dom-stat-wide">
          <div className="dom-stat-label">top 10 genres</div>
          <div className="dom-bars">
            {topTenGenres.map(([g, n]) => (
              <div key={g} className="dom-bar">
                <span className="dom-bar-label">{g}</span>
                <div className="dom-bar-track">
                  <div className="dom-bar-fill" style={{ width: `${(n / total) * 100}%` }} />
                </div>
                <span className="dom-bar-num">{n}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="dom-profile-section">
        <h2 className="dom-section-title">Five stars · 다섯별 앨범</h2>
        <div className="dom-fives">
          {fives.map((a) => (
            <button key={a.id} className="dom-fives-item" onClick={() => onOpen(a)}>
              <div>
                <Cover album={a} size="100%" />
              </div>
              <div className="dom-fives-info">
                <div className="dom-fives-title">{a.title}</div>
                <div className="dom-fives-artist">{a.artist}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
