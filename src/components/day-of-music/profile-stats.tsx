// profile-stats.tsx — Profile / Year in Listening: a wrapped-style recap.

"use client";

import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";

import { getAlbumStats, type AlbumStats } from "@/lib/day-of-music/album-stats";
import { useJournal, type JournalAlbum } from "@/lib/day-of-music/use-journal";
import { useThemes } from "@/lib/day-of-music/themes";
import { StatsShareCard } from "@/components/day-of-music/stats-share-card";
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

export function ProfileStats() {
  const { allAlbums } = useJournal();
  const { themes } = useThemes();
  // Which theme's recap modal is open. Stored as an id (not the recap object)
  // so the modal always renders the freshest stats after a log/edit.
  const [openThemeId, setOpenThemeId] = useState<string | null>(null);
  const [shareYear, setShareYear] = useState(false);
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

      {/* Theme analysis — the exact same share-card modal as the year card
          below (one component, so the two can never drift apart). */}
      {openTheme && (
        <StatsShareCard
          title={`${openTheme.name} · ${currentYear}`}
          themeLabel={`${openTheme.emoji} ${openTheme.name}`}
          sub={`in ${openTheme.name} this year`}
          stats={openTheme}
          showFives
          filenameParts={[openTheme.name, currentYear, "recap"]}
          onClose={() => setOpenThemeId(null)}
        />
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

    </div>
  );
}
