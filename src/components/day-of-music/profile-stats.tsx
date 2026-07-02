// profile-stats.tsx — Profile / Year in Listening: a wrapped-style recap.

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";

import { getAlbumStats, type AlbumStats } from "@/lib/day-of-music/album-stats";
import { type Album } from "@/lib/day-of-music/data";
import { saveCardAsImage, shareFileName } from "@/lib/day-of-music/save-card";
import { useJournal, type JournalAlbum } from "@/lib/day-of-music/use-journal";
import { useThemes } from "@/lib/day-of-music/themes";
import { Cover } from "@/components/day-of-music/cover";
import {
  StatsPoster,
  StatsShareCard,
} from "@/components/day-of-music/stats-share-card";
import { Button, Stars } from "@/components/day-of-music/atoms";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

type ThemeRecap = AlbumStats<JournalAlbum> & {
  id: string;
  name: string;
  emoji: string;
};

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
  const [shareYear, setShareYear] = useState(false);
  // Theme whose poster is being exported straight to a PNG. The poster mounts
  // off-screen (no second modal on top of the recap) just long enough to save.
  const [exportThemeId, setExportThemeId] = useState<string | null>(null);
  const exportRef = useRef<HTMLDivElement>(null);
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
  const exportTheme = exportThemeId
    ? (themeRecaps.find((t) => t.id === exportThemeId) ?? null)
    : null;

  // Esc closes this page's overlays (year share card first — it opens on
  // top). The app-level Esc handler only closes its own overlays (day detail /
  // add / share / tweaks), so no conflict here.
  useEffect(() => {
    if (!openThemeId && !shareYear) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (shareYear) setShareYear(false);
      else setOpenThemeId(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openThemeId, shareYear]);

  // Once the off-screen poster is mounted, rasterize + download it, then
  // unmount it. saveCardAsImage never throws (it toasts success/failure).
  // The timeout is an escape hatch for a stalled rasterizer, so the SHARE
  // CARD button can't stay locked on "SAVING…" forever.
  const exportThemeName = exportTheme?.name;
  useEffect(() => {
    if (!exportThemeId || !exportThemeName) return;
    const node = exportRef.current;
    if (!node) {
      setExportThemeId(null);
      return;
    }
    void saveCardAsImage(
      node,
      shareFileName([exportThemeName, currentYear, "recap"]),
    ).finally(() => setExportThemeId(null));
    const bail = setTimeout(() => setExportThemeId(null), 30_000);
    return () => clearTimeout(bail);
  }, [exportThemeId, exportThemeName, currentYear]);

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
          <Button onClick={() => setShareYear(true)}>SHARE CARD</Button>
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
              <div className="dom-theme-modal-hd-actions">
                <span className="dom-theme-row-meta">
                  {openTheme.total ? `${openTheme.total} logs` : "No logs yet"}
                </span>
                {openTheme.total > 0 && (
                  <Button
                    disabled={exportThemeId !== null}
                    onClick={() => setExportThemeId(openTheme.id)}
                  >
                    {exportThemeId ? "SAVING…" : "SHARE CARD"}
                  </Button>
                )}
              </div>
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

      {shareYear && (
        <StatsShareCard
          title={`${currentYear} · Year in Music`}
          themeLabel={themeLaneLabel}
          sub={`across ${themeLaneLabel} · ${daysSinceYearStart} days`}
          stats={allStats}
          filenameParts={["Year-in-Music", currentYear]}
          onClose={() => setShareYear(false)}
        />
      )}

      {/* Off-screen poster for the theme SHARE CARD: mounted only while the
          PNG export runs, so no second modal stacks on the recap. */}
      {exportTheme && (
        <div className="dom-share-export-stage" aria-hidden="true">
          <StatsPoster
            ref={exportRef}
            title={`${exportTheme.name} · ${currentYear}`}
            themeLabel={`${exportTheme.emoji} ${exportTheme.name}`}
            sub={`in ${exportTheme.name} this year`}
            stats={exportTheme}
            showFives
          />
        </div>
      )}
    </div>
  );
}
