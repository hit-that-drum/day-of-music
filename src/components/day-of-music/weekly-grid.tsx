// weekly-grid.tsx — the Weekly Grid screen: header + 7-day grid of day cells.

"use client";

import { useCallback, useRef, useState, type CSSProperties, type DragEvent } from "react";
import { ArrowLeft, ArrowRight, CalendarSearch } from "lucide-react";

import {
  fmtDate,
  isSameMonth,
  parseDate,
  startOfWeek,
  weekOfMonth,
  type Album,
} from "@/lib/day-of-music/data";
import { useJournal } from "@/lib/day-of-music/use-journal";
import { useBestOfWeekStatus, type BestOfStatus } from "@/lib/day-of-music/best-of";
import { useDateNames, useT } from "@/lib/day-of-music/i18n";
import { useNavSlide, useSwipeNav } from "@/lib/day-of-music/use-swipe-nav";
import { BestOfButton } from "@/components/day-of-music/best-of-button";
import { Cover } from "@/components/day-of-music/cover";
import { Button, IconButton, MetaLine } from "@/components/day-of-music/atoms";
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
  /** Open the Best of Week tournament modal. */
  onBestOf: () => void;
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
  onBestOf,
  onMove,
}: WeeklyGridProps) {
  const { albumsByDate } = useJournal();
  const t = useT();
  const names = useDateNames();
  // Drives the Best-of button's colour, so the week's state is visible without
  // opening the modal.
  const bestOf = useBestOfWeekStatus(days, labelDate, splitByMonth, today);
  // Phone-only swipe: finger left → next week, right → previous (the hook
  // ignores mouse pointers and ≥761px viewports itself).
  const boardRef = useRef<HTMLDivElement>(null);
  useSwipeNav(boardRef, { onLeft: onNext, onRight: onPrev });
  // Phone-only slide-in when the visible week changes. Keyed on labelDate, not
  // days[0]: in split mode prev/next can move between two segments of the same
  // Mon–Sun week (day-of-music-app.tsx prevWeek/nextWeek) and days[0] would not
  // change. YYYY-MM-DD compares lexicographically.
  const gridRef = useRef<HTMLDivElement>(null);
  useNavSlide(gridRef, fmtDate(labelDate));

  // Colour is never the only cue: every non-plain state also carries a hint
  // spelling itself out (and "done" a 🏆) — the Minimal aesthetic's accent
  // equals its ink, and colour alone excludes colour-blind readers either way.
  // Days are named by weekday, the natural handle for a day inside one week.
  // Computed once here because the Best-of / Share pair renders twice (header
  // row on desktop, the grid's label cell on phones).
  const bestOfHint =
    bestOf.status === "done" && bestOf.winnerDate
      ? t("bow.doneHint", { day: names.weekdayShort(parseDate(bestOf.winnerDate)) })
      : bestOf.status === "locked"
        ? t("bow.lockedHint", { day: names.weekdayShort(bestOf.lastDay) })
        : bestOf.status === "empty"
          ? t("bow.emptyHint")
          : undefined;

  // A locked week still takes the click — it answers with the reason instead of
  // opening the tournament. `disabled` would swallow the tap and leave a
  // touch-only user with no way to reach the explanation (no hover, no title).
  const locked = bestOf.status === "locked";
  const boardActionProps = {
    bestOfStatus: bestOf.status,
    bestOfHint,
    locked,
    onBestOf,
    onShare,
  };
  const monthLabel = names.monthLong(labelDate.getMonth());
  const weekNum = weekOfMonth(labelDate);
  // In split mode a day outside the labelled month is blanked (not interactive).
  const isOutOfMonth = (d: Date) => splitByMonth && !isSameMonth(d, labelDate);
  const todayKey = fmtDate(today);

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
      monthLabel: names.monthLong(d.getMonth()),
      weekNum: weekOfMonth(d),
    });
  }

  return (
    <div className="dom-week" ref={boardRef}>
      <WeekHeader
        segments={segments}
        labelDate={labelDate}
        today={today}
        onPrev={onPrev}
        onNext={onNext}
        onJump={onJump}
        {...boardActionProps}
      />
      <div
        className="dom-grid"
        ref={gridRef}
        style={{ "--cols": days.length } as CSSProperties}
      >
        {/* Label cell — only visible in the 2-column mobile grid. */}
        <div className="dom-grid-label">
          <div className="dom-grid-label-inner" aria-live="polite">
            <div className="dom-month-name">{monthLabel.toUpperCase()}</div>
            <div className="dom-month-sub">· {t("week.weekN", { n: weekNum })}</div>
            <div className="dom-month-tag">
              {labelDate.getFullYear()} · {t("week.curation")}
            </div>
          </div>
          {/* Best-of + Share live here on phones (display:none on desktop). */}
          <BoardActions {...boardActionProps} />
        </div>
        {days.map((d) => {
          const outOfMonth = isOutOfMonth(d);
          const album = outOfMonth ? undefined : albumsByDate[fmtDate(d)];
          const isToday = fmtDate(d) === todayKey;
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

type BoardActionProps = {
  /** Whether this week's Best-of is playable, already decided, or has nothing
   *  to judge — shown as the button's colour. */
  bestOfStatus: BestOfStatus;
  /** Spelled-out reason behind the colour (tooltip / toast / aria). */
  bestOfHint: string | undefined;
  /** Locked weeks take the click and answer with the hint instead. */
  locked: boolean;
  onBestOf: () => void;
  onShare: () => void;
};

// Best-of + Share. Rendered twice: in the header's action row (desktop) and in
// the grid's phone-only label cell. CSS shows exactly one of the two per
// breakpoint (display:contents in the row on desktop, display:none there on
// phones), so the desktop header row is byte-identical to before.
function BoardActions({ bestOfStatus, bestOfHint, locked, onBestOf, onShare }: BoardActionProps) {
  const t = useT();
  return (
    <div className="dom-board-actions">
      <BestOfButton
        status={bestOfStatus}
        hint={bestOfHint}
        blocked={locked}
        label={t("bow.button")}
        onOpen={onBestOf}
      />
      <Button onClick={onShare}>{t("week.shareWeek").toUpperCase()}</Button>
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
  onBestOf,
  bestOfStatus,
  bestOfHint,
  locked,
}: BoardActionProps & {
  segments: { key: number; monthLabel: string; weekNum: number }[];
  labelDate: Date;
  today: Date;
  onPrev: () => void;
  onNext: () => void;
  onJump: (date: Date) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const t = useT();

  return (
    <div className="dom-week-hd dom-week-hd-board">
      <div className="dom-week-title">
        <span className="dom-eyebrow">{t("week.eyebrow")}</span>
        <div className="dom-week-title-anchor">
          <button
            className="dom-week-title-btn"
            onClick={() => setPickerOpen((o) => !o)}
            aria-haspopup="dialog"
            aria-expanded={pickerOpen}
            title={t("week.jumpTitle")}
          >
            <h1>
              {segments.map((s, i) => (
                <span key={s.key}>
                  {i > 0 && <span className="dom-week-title-sep"> / </span>}
                  {s.monthLabel}
                  <span className="dom-week-title-break">
                    {" · "}
                    {t("week.weekN", { n: s.weekNum })}
                  </span>
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
      {/* DOM order = phone visual order: [←] [jump] [→] then Best-of/Share. On
          desktop the jump button is display:none and .dom-board-actions is
          display:contents, so the flex row stays ← → Best-of Share. */}
      <div className="dom-week-actions">
        <IconButton icon={ArrowLeft} onClick={onPrev} aria-label={t("aria.prevWeek")} />
        <Button
          variant="ghost"
          size="sm"
          className="dom-week-jump"
          onClick={() => setPickerOpen((o) => !o)}
          aria-haspopup="dialog"
          aria-expanded={pickerOpen}
        >
          <CalendarSearch size={16} aria-hidden="true" />
          {t("week.jumpTitle")}
        </Button>
        <IconButton icon={ArrowRight} onClick={onNext} aria-label={t("aria.nextWeek")} />
        <BoardActions
          bestOfStatus={bestOfStatus}
          bestOfHint={bestOfHint}
          locked={locked}
          onBestOf={onBestOf}
          onShare={onShare}
        />
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
  const t = useT();
  const names = useDateNames();
  const day = date.getDate();
  const dow = names.weekdayShort(date);
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
          aria-label={t("aria.openAlbum", { title: album.title })}
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
              <div className="dom-from">{t("common.fromAlbum", { title: album.albumTitle })}</div>
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
          aria-label={t("aria.logForDate", { date: fmtDate(date) })}
        >
          <span className="dom-day-add-mark">＋</span>
          <span className="dom-day-add-lbl">{t("common.logShort")}</span>
        </button>
      )}
    </div>
  );
}
