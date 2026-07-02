// profile-stats.tsx — Profile / Year in Listening: a wrapped-style recap.

"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";

import { normalizeGenre, type Album } from "@/lib/day-of-music/data";
import { useJournal, type JournalAlbum } from "@/lib/day-of-music/use-journal";
import { useThemes } from "@/lib/day-of-music/themes";
import { Cover } from "@/components/day-of-music/cover";
import { Button, Stars } from "@/components/day-of-music/atoms";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

type AlbumStats<T extends Album> = {
  total: number;
  avgRatingNum: number;
  avgRating: string;
  genreCount: number;
  topTenGenres: [string, number][];
  fives: T[];
};

type ThemeRecap = AlbumStats<JournalAlbum> & {
  id: string;
  name: string;
  emoji: string;
};

function getAlbumStats<T extends Album>(albums: T[]): AlbumStats<T> {
  const total = albums.length;
  const avgRatingNum = total
    ? albums.reduce((s, a) => s + a.rating, 0) / total
    : 0;

  const byGenre: Record<string, number> = {};
  albums.forEach((a) => {
    const genre = normalizeGenre(a.genre);
    if (genre) byGenre[genre] = (byGenre[genre] ?? 0) + 1;
  });

  return {
    total,
    avgRatingNum,
    avgRating: total ? avgRatingNum.toFixed(2) : "—",
    genreCount: Object.keys(byGenre).length,
    topTenGenres: Object.entries(byGenre)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10),
    fives: albums.filter((a) => a.rating === 5),
  };
}

function fallbackThemeName(id: string): string {
  if (!id) return "Untitled theme";
  return id
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function ProfileStats({ onOpen }: { onOpen: (album: Album) => void }) {
  const { allAlbums } = useJournal();
  const { themes } = useThemes();
  // Which theme's recap modal is open. Stored as an id (not the recap object)
  // so the modal always renders the freshest stats after a log/edit.
  const [openThemeId, setOpenThemeId] = useState<string | null>(null);
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentYearLabel = String(currentYear);
  const todayUtc = Date.UTC(currentYear, today.getMonth(), today.getDate());
  const yearStartUtc = Date.UTC(currentYear, 0, 1);
  const daysSinceYearStart =
    Math.floor((todayUtc - yearStartUtc) / MS_PER_DAY) + 1;

  const yearAlbums = useMemo(
    () => allAlbums.filter((a) => a.date.slice(0, 4) === currentYearLabel),
    [allAlbums, currentYearLabel],
  );
  const allStats = useMemo(() => getAlbumStats(yearAlbums), [yearAlbums]);
  const themeRecaps = useMemo<ThemeRecap[]>(() => {
    return themes.map((theme) => {
      const albums = yearAlbums.filter((a) => a.theme === theme.id);
      return {
        id: theme.id,
        name: theme.name || fallbackThemeName(theme.id),
        emoji: theme.emoji || "♪",
        ...getAlbumStats(albums),
      };
    });
  }, [themes, yearAlbums]);
  const themeLaneLabel = `${themeRecaps.length} ${
    themeRecaps.length === 1 ? "theme lane" : "theme lanes"
  }`;
  const openTheme = openThemeId
    ? (themeRecaps.find((t) => t.id === openThemeId) ?? null)
    : null;

  // Esc closes the theme recap modal. The app-level Esc handler only closes
  // its own overlays (day detail / add / share / tweaks), so no conflict here.
  useEffect(() => {
    if (!openThemeId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenThemeId(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openThemeId]);

  return (
    <div className="dom-profile">
      <div className="dom-week-hd">
        <div className="dom-week-title">
          <span className="dom-eyebrow">
            올해의 청음 · {currentYear} in listening
          </span>
          <h1>My Year in Music</h1>
        </div>
        <div className="dom-week-actions">
          <Button variant="ghost">Export</Button>
          <Button>Share card</Button>
        </div>
      </div>

      <div className="dom-stats-grid">
        <div className="dom-stat dom-stat-lg">
          <div className="dom-stat-label">albums logged</div>
          <div className="dom-stat-num">
            {String(allStats.total).padStart(2, "0")}
          </div>
          <div className="dom-stat-sub">
            across {themeLaneLabel} · {daysSinceYearStart} days
          </div>
        </div>
        <div className="dom-stat">
          <div className="dom-stat-label">average rating</div>
          <div className="dom-stat-num">{allStats.avgRating}</div>
          <div className="dom-stat-sub">
            <Stars value={Math.round(allStats.avgRatingNum)} size={14} />
          </div>
        </div>
        <div className="dom-stat">
          <div className="dom-stat-label">five-star picks</div>
          <div className="dom-stat-num">{allStats.fives.length}</div>
          <div className="dom-stat-sub">
            {allStats.total
              ? Math.round((allStats.fives.length / allStats.total) * 100)
              : 0}
            % of catalog
          </div>
        </div>
        <div className="dom-stat dom-stat-wide">
          <div className="dom-stat-label">top 10 genres</div>
          <div className="dom-bars">
            {allStats.topTenGenres.length ? (
              allStats.topTenGenres.map(([g, n]) => (
                <div key={g} className="dom-bar">
                  <span className="dom-bar-label">{g}</span>
                  <div className="dom-bar-track">
                    <div
                      className="dom-bar-fill"
                      style={{ width: `${(n / allStats.total) * 100}%` }}
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

      <div className="dom-profile-section">
        <div className="dom-profile-section-hd">
          <h2 className="dom-section-title">By theme · 테마별 기록</h2>
          <span className="dom-section-sub">
            {themeRecaps.length} {themeRecaps.length === 1 ? "theme" : "themes"}
          </span>
        </div>
        <div className="dom-theme-list">
          {themeRecaps.map((theme) => (
            <button
              key={theme.id}
              type="button"
              className="dom-theme-row"
              onClick={() => setOpenThemeId(theme.id)}
            >
              <div className="dom-theme-recap-title">
                <span className="dom-theme-recap-emoji" aria-hidden="true">
                  {theme.emoji}
                </span>
                <div>
                  <div className="dom-stat-label">theme analysis</div>
                  <h3>{theme.name}</h3>
                </div>
              </div>
              <span className="dom-theme-row-meta">
                {theme.total ? `${theme.total} logs` : "No logs yet"}
              </span>
              <ChevronRight
                className="dom-theme-row-icon"
                size={18}
                aria-hidden="true"
              />
            </button>
          ))}
        </div>
      </div>

      {openTheme && (
        <div
          className="dom-scrim"
          onClick={() => setOpenThemeId(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`${openTheme.name} theme recap`}
        >
          <div className="dom-theme-modal" onClick={(e) => e.stopPropagation()}>
            <button
              className="dom-detail-close"
              onClick={() => setOpenThemeId(null)}
              aria-label="Close"
            >
              ✕
            </button>

            <div className="dom-theme-modal-hd">
              <div className="dom-theme-recap-title">
                <span className="dom-theme-recap-emoji" aria-hidden="true">
                  {openTheme.emoji}
                </span>
                <div>
                  <div className="dom-stat-label">theme analysis</div>
                  <h3>{openTheme.name}</h3>
                </div>
              </div>
              <span className="dom-theme-row-meta">
                {openTheme.total ? `${openTheme.total} logs` : "No logs yet"}
              </span>
            </div>

            <div className="dom-theme-modal-body">
              <div className="dom-theme-recap">
                {openTheme.total ? (
                  <>
                    <div className="dom-theme-recap-grid">
                      <div className="dom-stat dom-stat-compact">
                        <div className="dom-stat-label">albums</div>
                        <div className="dom-stat-num">
                          {String(openTheme.total).padStart(2, "0")}
                        </div>
                        <div className="dom-stat-sub">
                          {openTheme.genreCount} genres
                        </div>
                      </div>
                      <div className="dom-stat dom-stat-compact">
                        <div className="dom-stat-label">average</div>
                        <div className="dom-stat-num">
                          {openTheme.avgRating}
                        </div>
                        <div className="dom-stat-sub">
                          <Stars
                            value={Math.round(openTheme.avgRatingNum)}
                            size={13}
                          />
                        </div>
                      </div>
                      <div className="dom-stat dom-stat-compact">
                        <div className="dom-stat-label">five-stars</div>
                        <div className="dom-stat-num">
                          {openTheme.fives.length}
                        </div>
                        <div className="dom-stat-sub">
                          {Math.round(
                            (openTheme.fives.length / openTheme.total) * 100,
                          )}
                          % of theme
                        </div>
                      </div>
                      <div className="dom-stat dom-stat-compact dom-theme-genre-card">
                        <div className="dom-stat-label">top genres</div>
                        <div className="dom-bars">
                          {openTheme.topTenGenres.length ? (
                            openTheme.topTenGenres.slice(0, 5).map(([g, n]) => (
                              <div key={g} className="dom-bar">
                                <span className="dom-bar-label">{g}</span>
                                <div className="dom-bar-track">
                                  <div
                                    className="dom-bar-fill"
                                    style={{
                                      width: `${(n / openTheme.total) * 100}%`,
                                    }}
                                  />
                                </div>
                                <span className="dom-bar-num">{n}</span>
                              </div>
                            ))
                          ) : (
                            <div className="dom-stat-empty">
                              No genres logged yet.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="dom-theme-fives">
                      <div className="dom-theme-fives-title">
                        Five stars · 다섯별 앨범
                      </div>
                      {openTheme.fives.length ? (
                        <div className="dom-fives dom-fives-compact">
                          {openTheme.fives.map((a) => (
                            <button
                              key={`${openTheme.id}:${a.date}:${a.id}`}
                              className="dom-fives-item"
                              onClick={() => {
                                // Hand off to the Day Detail modal — close this
                                // one first so overlays don't stack.
                                setOpenThemeId(null);
                                onOpen(a);
                              }}
                            >
                              <div>
                                <Cover album={a} size="100%" />
                              </div>
                              <div className="dom-fives-info">
                                <div className="dom-fives-title">{a.title}</div>
                                <div className="dom-fives-artist">
                                  {a.artist}
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="dom-empty dom-theme-empty">
                          No five-star albums in this theme yet.
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="dom-empty dom-theme-empty">
                    This theme has no albums logged for {currentYear}.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
