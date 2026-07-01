// share-card.tsx — Share Week: a shareable poster of the current week.
// The poster body mirrors the Weekly Grid exactly (same .dom-grid/.dom-day
// markup), so the saved image matches what the user sees on the week board.

"use client";

import { useRef } from "react";

import {
  DOW,
  MONTHS_LONG,
  fmtDate,
  weekOfMonth,
  type Album,
} from "@/lib/day-of-music/data";
import { useJournal } from "@/lib/day-of-music/use-journal";
import { DEFAULT_USERNAME, useProfile } from "@/lib/day-of-music/profile";
import { useActiveTheme, useThemes } from "@/lib/day-of-music/themes";
import { copyCurrentLink, saveCardAsImage, shareFileName } from "@/lib/day-of-music/save-card";
import { Cover } from "@/components/day-of-music/cover";
import { Button, MetaLine } from "@/components/day-of-music/atoms";

export function ShareCard({
  weekStart,
  days,
  splitByMonth,
  onClose,
}: {
  /** Day whose month + week-number label the header shows (the week's label day). */
  weekStart: Date;
  /** The full Mon–Sun strip (7 days). */
  days: Date[];
  /** When true, days outside the labelled month are blanked (split-by-month). */
  splitByMonth: boolean;
  onClose: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const { albumsByDate } = useJournal();
  const { username } = useProfile();
  const { themes } = useThemes();
  const { activeTheme } = useActiveTheme();
  const activeThemeObj = themes.find((t) => t.id === activeTheme) ?? themes[0];
  const themeName = activeThemeObj?.name ?? "Daily";
  const themeEmoji = activeThemeObj?.emoji ?? "🎧";

  const monthLabel = MONTHS_LONG[weekStart.getMonth()];
  const weekNum = weekOfMonth(weekStart);
  const labelMonth = weekStart.getMonth();
  const labelYear = weekStart.getFullYear();

  const isOutOfMonth = (d: Date) =>
    splitByMonth && (d.getMonth() !== labelMonth || d.getFullYear() !== labelYear);

  // One entry per visible day, mirroring the weekly grid (album, blank, or
  // out-of-month). Out-of-month days never carry an album.
  const cells = days.slice(0, 7).map((d) => {
    const outOfMonth = isOutOfMonth(d);
    return { d, outOfMonth, album: outOfMonth ? undefined : albumsByDate[fmtDate(d)] };
  });

  // Footer stats only count albums that belong to the labelled month.
  const week = cells.map((c) => c.album).filter((a): a is Album => Boolean(a));
  const genreCount = new Set(week.map((a) => a.genre)).size;
  const avg = week.length
    ? (week.reduce((s, a) => s + a.rating, 0) / week.length).toFixed(1)
    : "—";

  function handleSaveImage() {
    if (!cardRef.current) return;
    void saveCardAsImage(cardRef.current, shareFileName([themeName, monthLabel, weekNum]));
  }

  return (
    <div className="dom-scrim" onClick={onClose} role="dialog" aria-modal="true" aria-label="SHARE WEEK">
      <div className="dom-share" onClick={(e) => e.stopPropagation()}>
        <button className="dom-detail-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <div className="dom-share-card" ref={cardRef}>
          <div className="dom-share-hd">
            <div>
              <div className="dom-share-eyebrow">DAY · OF · MUSIC</div>
              <div className="dom-share-title">
                {monthLabel} · Week {weekNum}
              </div>
            </div>
            <div className="dom-share-meta">
              <span className="dom-share-user">@{username.trim() || DEFAULT_USERNAME}</span>
              <span className="dom-share-theme">
                {themeEmoji ? `${themeEmoji} ${themeName}` : themeName}
              </span>
            </div>
          </div>

          {/* Week grid — identical markup/classes to the weekly board. */}
          <div className="dom-grid dom-share-week" style={{ ["--cols" as string]: cells.length }}>
            {cells.map(({ d, outOfMonth, album }) => {
              return (
                <div
                  key={fmtDate(d)}
                  className="dom-day"
                  data-empty={album ? "0" : "1"}
                  data-outmonth={outOfMonth ? "1" : "0"}
                >
                  <div className="dom-day-hd">
                    <span className="dom-day-num">{d.getDate()}</span>
                    <span className="dom-day-bar">|</span>
                    <span className="dom-day-dow">{DOW[d.getDay()]}</span>
                    <span className="dom-day-album-rating">
                      <span>★</span>{album?.rating}
                    </span>
                  </div>
                  {outOfMonth ? (
                    <div className="dom-day-body dom-day-empty dom-day-blank" aria-hidden="true" />
                  ) : album ? (
                    <div className="dom-day-body">
                      <div className="dom-cover-wrap" style={{ maxWidth: 220 }}>
                        <Cover album={album} size="100%" />
                      </div>
                      <div className="dom-day-meta">
                        <div className="dom-title">{album.title}</div>
                        <div className="dom-artist">
                          {album.artist}
                          {album.titleKo && (
                            <span className="dom-artist-ko"> · {album.titleKo}</span>
                          )}
                        </div>
                        {album.kind === "track" && album.albumTitle && (
                          <div className="dom-from">from 〈{album.albumTitle}〉</div>
                        )}
                        <MetaLine album={album} />
                      </div>
                    </div>
                  ) : (
                    <div className="dom-day-body dom-day-empty" />
                  )}
                </div>
              );
            })}
          </div>

          <div className="dom-share-ft">
            <div>
              {week.length} albums · {genreCount} genres
            </div>
            <div className="dom-day-album-rating">
              <span>★</span> 
              {avg}
            </div>
          </div>
        </div>
        <div className="dom-share-actions">
          <Button variant="ghost" onClick={() => void copyCurrentLink()}>
            Copy link
          </Button>
          <Button onClick={handleSaveImage}>
            Save image
          </Button>
        </div>
      </div>
    </div>
  );
}
