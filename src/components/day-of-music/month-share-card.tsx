// month-share-card.tsx — Share Month: a shareable poster of the month calendar.
// Mirrors the monthly board grid (same .dom-month-cal markup) inside the share
// chrome, so the saved image matches what the user sees.

"use client";

import { useRef } from "react";
import dayjs from "dayjs";

import {
  DOW_KO,
  MONTHS_LONG,
  addDays,
  fmtDate,
  normalizeGenre,
  startOfWeek,
} from "@/lib/day-of-music/data";
import { useJournal } from "@/lib/day-of-music/use-journal";
import { DEFAULT_USERNAME, useProfile } from "@/lib/day-of-music/profile";
import { useActiveTheme, useThemes } from "@/lib/day-of-music/themes";
import { copyCurrentLink, saveCardAsImage, shareFileName } from "@/lib/day-of-music/save-card";
import { Cover } from "@/components/day-of-music/cover";
import { Button } from "@/components/day-of-music/atoms";

export function MonthShareCard({
  anchor,
  onClose,
}: {
  anchor: Date;
  onClose: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const { albums, albumsByDate } = useJournal();
  const { username } = useProfile();
  const { themes } = useThemes();
  const { activeTheme } = useActiveTheme();
  const activeThemeObj = themes.find((t) => t.id === activeTheme) ?? themes[0];
  const themeName = activeThemeObj?.name ?? "Daily";
  const themeEmoji = activeThemeObj?.emoji ?? "🎧";

  const current = dayjs(anchor);
  const year = current.year();
  const month = current.month();
  const monthLabel = MONTHS_LONG[month];

  const lastOfMonth = current.endOf("month");
  const calStart = startOfWeek(current.startOf("month").toDate());
  const numWeeks = Math.ceil((lastOfMonth.diff(dayjs(calStart), "day") + 1) / 7);
  const days = Array.from({ length: numWeeks * 7 }, (_, i) => addDays(calStart, i));

  const monthAlbums = albums.filter((a) => {
    const d = dayjs(a.date);
    return d.month() === month && d.year() === year;
  });
  const genreCount = new Set(monthAlbums.map((a) => normalizeGenre(a.genre)).filter(Boolean)).size;
  const avg = monthAlbums.length
    ? (monthAlbums.reduce((s, a) => s + a.rating, 0) / monthAlbums.length).toFixed(1)
    : "—";

  function handleSaveImage() {
    if (!cardRef.current) return;
    void saveCardAsImage(cardRef.current, shareFileName([themeName, monthLabel, year]));
  }

  return (
    <div className="dom-scrim" onClick={onClose} role="dialog" aria-modal="true" aria-label="SHARE MONTH">
      <div className="dom-share dom-share-month" onClick={(e) => e.stopPropagation()}>
        <button className="dom-detail-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <div className="dom-share-card dom-share-card-month" ref={cardRef}>
          <div className="dom-share-hd">
            <div>
              <div className="dom-share-eyebrow">DAY · OF · MUSIC</div>
              <div className="dom-share-title">
                {monthLabel} · {year}
              </div>
            </div>
            <div className="dom-share-meta">
              <span className="dom-share-user">@{username.trim() || DEFAULT_USERNAME}</span>
              <span className="dom-share-theme">
                {themeEmoji ? `${themeEmoji} ${themeName}` : themeName}
              </span>
            </div>
          </div>

          {/* Month grid — identical markup/classes to the monthly board. */}
          <div className="dom-month-cal dom-share-monthcal">
            <div className="dom-month-cal-hd">
              {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((d, i) => (
                <div key={d} className="dom-month-cal-dow">
                  <span>{d}</span>
                  <span className="dom-month-cal-dowKo">{DOW_KO[(i + 1) % 7]}</span>
                </div>
              ))}
            </div>
            <div
              className="dom-month-cal-grid"
              style={{ gridTemplateRows: `repeat(${numWeeks}, minmax(120px, auto))` }}
            >
              {days.map((d, i) => {
                const inMonth = d.getMonth() === month;
                const album = inMonth ? albumsByDate[fmtDate(d)] : undefined;
                return (
                  <div
                    key={i}
                    className="dom-month-cal-cell"
                    data-inmonth={inMonth ? "1" : "0"}
                    data-empty={album ? "0" : "1"}
                  >
                    {inMonth && (
                      <>
                        <div className="dom-month-cal-date">
                          <span className="dom-month-cal-num">{d.getDate()}</span>
                          <span className="dom-month-cal-date-right">
                            {album && album.rating > 0 && (
                              <span className="dom-month-cal-rating">
                                <span className="dom-month-cal-rating-star">★</span>
                                {album.rating}
                              </span>
                            )}
                          </span>
                        </div>
                        {album && (
                          <div className="dom-month-cal-cover">
                            <Cover album={album} size="100%" />
                          </div>
                        )}
                        {album && (
                          <div className="dom-month-cal-info">
                            <div className="dom-month-cal-title">{album.title}</div>
                            <div className="dom-month-cal-artist">
                              {album.artist}
                              {album.titleKo && (
                                <span className="dom-month-cal-artist-ko"> · {album.titleKo}</span>
                              )}
                            </div>
                            {album.kind === "track" && album.albumTitle && (
                              <div className="dom-from">from 〈{album.albumTitle}〉</div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="dom-share-ft">
            <div>
              {monthAlbums.length} albums · {genreCount} genres
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
