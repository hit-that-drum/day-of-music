// weekly-grid.tsx — the Weekly Grid screen: header + 7-day grid of day cells.

"use client";

import { useCallback, useState, type DragEvent } from "react";

import {
  DOW,
  DOW_KO,
  MONTHS_LONG,
  fmtDate,
  startOfWeek,
  weekOfMonth,
  type Album,
} from "@/lib/day-of-music/data";
import { useJournal } from "@/lib/day-of-music/use-journal";
import { Cover } from "@/components/day-of-music/cover";
import { Button, MetaLine } from "@/components/day-of-music/atoms";
import { WeekPicker } from "@/components/day-of-music/week-picker";

type WeeklyGridProps = {
  days: Date[];
  /** Day whose month + week-number label the header shows. Equals the week's
   *  Monday normally, or the first in-month day in split mode. */
  labelDate: Date;
  /** When true (split-by-month), days outside the labelled month are shown as
   *  blank, inactive cells instead of being interactive. */
  splitByMonth: boolean;
  today: Date;
  onOpen: (album: Album) => void;
  /** Open the add-flow with this YYYY-MM-DD preselected. */
  onAdd: (date: string) => void;
  onPrev: () => void;
  onNext: () => void;
  /** Jump the view to the week containing this date (mini-calendar pick). */
  onJump: (date: Date) => void;
  onShare: () => void;
  /** Reschedule via drag-and-drop. Dropping on an empty day moves the album;
   *  dropping on a filled day swaps the two albums' dates. */
  onMove: (fromDate: string, toDate: string) => void;
};

export function WeeklyGrid({
  days,
  labelDate,
  splitByMonth,
  today,
  onOpen,
  onAdd,
  onPrev,
  onNext,
  onJump,
  onShare,
  onMove,
}: WeeklyGridProps) {
  const { albumsByDate } = useJournal();
  const monthLabel = MONTHS_LONG[labelDate.getMonth()];
  const weekNum = weekOfMonth(labelDate);
  const labelMonth = labelDate.getMonth();
  const labelYear = labelDate.getFullYear();
  // In split mode a day outside the labelled month is blanked (not interactive).
  const isOutOfMonth = (d: Date) =>
    splitByMonth && (d.getMonth() !== labelMonth || d.getFullYear() !== labelYear);

  // Header segments: one per calendar month present among the active days. When
  // a continuous (non-split) week straddles two months we show both, e.g.
  // "December — Week 5 / January — Week 1". In split mode only one month is
  // active, so there's a single segment.
  const segments: { key: number; monthLabel: string; weekNum: number }[] = [];
  for (const d of days) {
    if (isOutOfMonth(d)) continue;
    const key = d.getFullYear() * 12 + d.getMonth();
    if (segments[segments.length - 1]?.key === key) continue;
    segments.push({
      key,
      monthLabel: MONTHS_LONG[d.getMonth()],
      weekNum: weekOfMonth(d),
    });
  }

  return (
    <div className="dom-week">
      <WeekHeader
        segments={segments}
        labelDate={labelDate}
        today={today}
        onPrev={onPrev}
        onNext={onNext}
        onJump={onJump}
        onShare={onShare}
      />
      <div
        className="dom-grid"
        style={{ ["--cols" as string]: days.length }}
      >
        {/* Label cell — only visible in the 2-column mobile grid. */}
        <div className="dom-grid-label">
          <div className="dom-grid-label-inner">
            <div className="dom-month-name">{monthLabel.toUpperCase()}</div>
            <div className="dom-month-sub">· Week {weekNum}</div>
            <div className="dom-month-tag">{labelDate.getFullYear()} · 큐레이션</div>
          </div>
        </div>
        {days.map((d) => {
          const outOfMonth = isOutOfMonth(d);
          const album = outOfMonth ? undefined : albumsByDate[fmtDate(d)];
          const isToday = fmtDate(d) === fmtDate(today);
          const isFuture = d > today;
          return (
            <DayCell
              key={fmtDate(d)}
              date={d}
              album={album}
              isToday={isToday}
              isFuture={isFuture}
              outOfMonth={outOfMonth}
              onOpen={onOpen}
              onAdd={onAdd}
              onMove={onMove}
            />
          );
        })}
      </div>
    </div>
  );
}

function WeekHeader({
  segments,
  labelDate,
  today,
  onPrev,
  onNext,
  onJump,
  onShare,
}: {
  segments: { key: number; monthLabel: string; weekNum: number }[];
  labelDate: Date;
  today: Date;
  onPrev: () => void;
  onNext: () => void;
  onJump: (date: Date) => void;
  onShare: () => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div className="dom-week-hd">
      <div className="dom-week-title">
        <span className="dom-eyebrow">큐레이션 · weekly view</span>
        <div className="dom-week-title-anchor">
          <button
            className="dom-week-title-btn"
            onClick={() => setPickerOpen((o) => !o)}
            aria-haspopup="dialog"
            aria-expanded={pickerOpen}
            title="Jump to a week · 주 선택"
          >
            <h1>
              {segments.map((s, i) => (
                <span key={s.key}>
                  {i > 0 && <span className="dom-week-title-sep"> / </span>}
                  {s.monthLabel}
                  <span className="dom-week-title-break"> · Week {s.weekNum}</span>
                </span>
              ))}
            </h1>
            <span className="dom-week-title-caret" aria-hidden="true">
              ▾
            </span>
          </button>
          {pickerOpen && (
            <WeekPicker
              initialMonth={labelDate}
              selectedWeekStart={startOfWeek(labelDate)}
              today={today}
              onPick={onJump}
              onClose={() => setPickerOpen(false)}
            />
          )}
        </div>
      </div>
      <div className="dom-week-actions">
        <button className="dom-iconbtn" onClick={onPrev} aria-label="Previous week">
          ←
        </button>
        <button className="dom-iconbtn" onClick={onNext} aria-label="Next week">
          →
        </button>
        <Button onClick={onShare}>SHARE WEEK</Button>
      </div>
    </div>
  );
}

function DayCell({
  date,
  album,
  isToday,
  isFuture,
  outOfMonth,
  onOpen,
  onAdd,
  onMove,
}: {
  date: Date;
  album: Album | undefined;
  isToday: boolean;
  isFuture: boolean;
  /** Day belongs to the adjacent month (split mode): render blank + inactive. */
  outOfMonth: boolean;
  onOpen: (album: Album) => void;
  onAdd: (date: string) => void;
  onMove: (fromDate: string, toDate: string) => void;
}) {
  const day = date.getDate();
  const dow = DOW[date.getDay()];
  const dowKo = DOW_KO[date.getDay()];
  const [dragOver, setDragOver] = useState(false);

  // Any in-month day is a drop target (empty → move, filled → swap dates).
  const handleDragOver = useCallback(
    (e: DragEvent) => {
      if (outOfMonth) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDragOver(true);
    },
    [outOfMonth],
  );
  const handleDrop = useCallback(
    (e: DragEvent) => {
      if (outOfMonth) return;
      e.preventDefault();
      setDragOver(false);
      try {
        const { from } = JSON.parse(e.dataTransfer.getData("text/plain")) as {
          id: string;
          from: string;
        };
        if (from) onMove(from, fmtDate(date));
      } catch {
        /* ignore non-album drops */
      }
    },
    [outOfMonth, onMove, date],
  );
  // Only clear the highlight when the cursor actually leaves the cell — not when
  // it moves onto a child (album button, cover image), which would flicker it.
  const handleDragLeave = useCallback((e: DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false);
  }, []);

  return (
    <div
      className="dom-day"
      data-today={isToday && !outOfMonth ? "1" : "0"}
      data-future={isFuture ? "1" : "0"}
      data-empty={album ? "0" : "1"}
      data-outmonth={outOfMonth ? "1" : "0"}
      data-dragover={dragOver ? "1" : "0"}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="dom-day-hd">
        <span className="dom-day-num">{day}</span>
        <span className="dom-day-bar">|</span>
        <span className="dom-day-dow">{dow}</span>
        <span className="dom-day-dowKo">{dowKo}</span>
      </div>
      {outOfMonth ? (
        <div className="dom-day-body dom-day-empty dom-day-blank" aria-hidden="true" />
      ) : album ? (
        <button
          className="dom-day-body dom-day-draggable"
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData(
              "text/plain",
              JSON.stringify({ id: album.id, from: album.date }),
            );
            e.dataTransfer.effectAllowed = "move";
          }}
          onClick={() => onOpen(album)}
          aria-label={`Open ${album.title}`}
        >
          <div className="dom-cover-wrap">
            <Cover album={album} size="100%" />
          </div>
          <div className="dom-day-meta">
            <div className="dom-title">{album.title}</div>
            <div className="dom-artist">
              {album.artist}
              {album.titleKo && <span className="dom-artist-ko"> · {album.titleKo}</span>}
            </div>
            {album.kind === "track" && album.albumTitle && (
              <div className="dom-from">from 〈{album.albumTitle}〉</div>
            )}
            <MetaLine album={album} />
          </div>
        </button>
      ) : isFuture ? (
        <div className="dom-day-body dom-day-empty" />
      ) : (
        <button
          className="dom-day-body dom-day-empty dom-day-add"
          onClick={() => onAdd(fmtDate(date))}
          aria-label={`Log an album for ${fmtDate(date)}`}
        >
          <span className="dom-day-add-mark">＋</span>
          <span className="dom-day-add-lbl">log · 기록</span>
        </button>
      )}
    </div>
  );
}
