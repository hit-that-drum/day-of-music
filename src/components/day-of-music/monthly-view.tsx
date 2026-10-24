// monthly-view.tsx — Monthly Overview: editorial calendar of the month.

"use client";

import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";

import {
  fmtDate,
  isSameMonth,
  monthEnd,
  monthGrid,
  parseDate,
  type Album,
} from "@/lib/day-of-music/data";
import { periodSummary } from "@/lib/day-of-music/album-stats";
import { useJournal } from "@/lib/day-of-music/use-journal";
import { useBestOfMonthStatus } from "@/lib/day-of-music/best-of";
import { useDateNames, useT } from "@/lib/day-of-music/i18n";
import { useNavSlide, useSwipeNav } from "@/lib/day-of-music/use-swipe-nav";
import { Button, IconButton } from "@/components/day-of-music/atoms";
import { BestOfButton } from "@/components/day-of-music/best-of-button";
import { Cover } from "@/components/day-of-music/cover";

export function MonthlyView({
  anchor,
  today,
  splitByMonth,
  onOpen,
  onAdd,
  onPrev,
  onNext,
  onJump,
  onShare,
  onBestOf,
  onMove,
}: {
  /** Any day inside the month being viewed. */
  anchor: Date;
  today: Date;
  /** Split-by-month tweak — decides how this month's weeks are segmented, and
   *  so which Best of Week results the month tournament looks up. */
  splitByMonth: boolean;
  onOpen: (album: Album) => void;
  /** Open the add-flow with this YYYY-MM-DD preselected (empty in-month days). */
  onAdd: (date: string) => void;
  onPrev: () => void;
  onNext: () => void;
  onJump: (date: Date) => void;
  /** Open the shareable image of this month. */
  onShare: () => void;
  /** Open the Best of Month tournament modal. */
  onBestOf: () => void;
  /** Reschedule via drag-and-drop. Dropping on an empty day moves the album;
   *  dropping on a filled day swaps the two albums' dates. */
  onMove: (fromDate: string, toDate: string) => void;
}) {
  const { albums, albumsByDate } = useJournal();
  const t = useT();
  const names = useDateNames();
  const bestOf = useBestOfMonthStatus(anchor, splitByMonth, today);
  // Date currently hovered as a drag-and-drop target (for highlight).
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  // The month being viewed follows `anchor`; `today` is only for highlighting.
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const isCurrentMonth = isSameMonth(today, anchor);
  // Phone-only swipe: finger left → next month, right → previous.
  const boardRef = useRef<HTMLDivElement>(null);
  useSwipeNav(boardRef, { onLeft: onNext, onRight: onPrev });
  // Phone-only slide-in when the month changes (DOW header + grid together).
  // Zero-padded so "2026-10" > "2026-09" and "2027-01" > "2026-12" lexically.
  const calRef = useRef<HTMLDivElement>(null);
  useNavSlide(calRef, fmtDate(anchor).slice(0, 7));

  // Mon-start month grid (5–6 rows).
  const { days, numWeeks } = monthGrid(anchor);
  const todayKey = fmtDate(today);

  const monthAlbums = albums.filter((a) => isSameMonth(a.date, anchor));

  // The same numbers the month share card shows. avgRating is "—" when empty.
  const { count: totalLogged, genres: genreCount, avg: avgRating } = periodSummary(monthAlbums);
  const completion = Math.round((totalLogged / monthEnd(anchor).getDate()) * 100);

  // The Best of Month button reports its state in colour, and explains any
  // blocker on click — mirroring the weekly button (see weekly-grid.tsx).
  const bestOfHint =
    bestOf.status === "done" && bestOf.winnerDate
      ? t("bom.doneHint", { date: names.monthDayShort(parseDate(bestOf.winnerDate)) })
      : bestOf.status === "locked"
        ? t("bom.lockedHint", { date: names.monthDayShort(bestOf.lastDay) })
        : bestOf.status === "pending"
          ? t("bom.pendingHint", { n: bestOf.pendingWeeks })
          : bestOf.status === "empty"
            ? t("bom.emptyHint")
            : undefined;
  // Blocked states keep taking the click and answer with the reason; `disabled`
  // would leave a touch-only user (no hover, no title) with no way to read it.
  const bestOfBlocked = bestOf.status === "locked" || bestOf.status === "pending";

  return (
    <div className="dom-month" ref={boardRef}>
      <div className="dom-month-hd">
        <div className="dom-month-hd-left">
          <span className="dom-eyebrow">
            {t("month.eyebrow", { month: names.monthLong(month) })}
          </span>
          <h1 className="dom-month-h1" aria-live="polite">
            <span className="dom-month-h1-name">{names.monthLong(month)}</span>
            <span className="dom-month-h1-year">{year}</span>
          </h1>
        </div>
        {/* The two wrappers are display:contents on desktop (same flex row as
            before); phones give them their own grid areas. */}
        <div className="dom-month-nav">
          <div className="dom-month-ctas">
            {!isCurrentMonth && (
              <Button className="dom-month-cta-today" onClick={() => onJump(today)}>
                {t("month.thisMonth").toUpperCase()}
              </Button>
            )}
            <BestOfButton
              status={bestOf.status}
              hint={bestOfHint}
              blocked={bestOfBlocked}
              label={t("bom.button")}
              onOpen={onBestOf}
            />
            <Button onClick={onShare}>{t("month.shareMonth").toUpperCase()}</Button>
          </div>
          <div className="dom-month-arrows">
            <IconButton icon={ArrowLeft} onClick={onPrev} aria-label={t("aria.prevMonth")} />
            <IconButton icon={ArrowRight} onClick={onNext} aria-label={t("aria.nextMonth")} />
          </div>
        </div>
        <div className="dom-month-hd-right">
          <div className="dom-month-stat">
            <span className="dom-month-stat-num">
              <i className="dom-month-stat-star">★</i> {avgRating}
            </span>
            <span className="dom-month-stat-lbl">{t("month.avgRating")}</span>
          </div>
          <div className="dom-month-stat">
            <span className="dom-month-stat-num">{String(totalLogged).padStart(2, "0")}</span>
            <span className="dom-month-stat-lbl">{t("month.albumsLogged")}</span>
          </div>
          <div className="dom-month-stat">
            <span className="dom-month-stat-num">
              {completion}
              <i>%</i>
            </span>
            <span className="dom-month-stat-lbl">{t("month.ofMonth")}</span>
          </div>
          <div className="dom-month-stat">
            <span className="dom-month-stat-num">{genreCount}</span>
            <span className="dom-month-stat-lbl">{t("month.genres")}</span>
          </div>
        </div>
      </div>

      <div className="dom-month-cal" ref={calRef}>
        <div className="dom-month-cal-hd">
          {names.weekdayRowMonFirst().map((d, i) => (
            <div key={i} className="dom-month-cal-dow">
              <span>{d}</span>
            </div>
          ))}
        </div>
        <div
          className="dom-month-cal-grid"
          style={{ gridTemplateRows: `repeat(${numWeeks}, minmax(140px, auto))` }}
        >
          {days.map((d, i) => {
            const inMonth = d.getMonth() === month;
            const dayKey = fmtDate(d);
            // Days outside the viewed month are blacked out — no album, no
            // date, nothing leaking in from the neighbouring month.
            const album = inMonth ? albumsByDate[dayKey] : undefined;
            const isToday = dayKey === todayKey;
            const isFuture = d > today;
            // Empty in-month days up to today get a "+ log" affordance, like the
            // week view. Future days stay blank (can't log ahead).
            const canAdd = inMonth && !album && !isFuture;
            return (
              <button
                key={i}
                className="dom-month-cal-cell"
                data-inmonth={inMonth ? "1" : "0"}
                data-today={isToday ? "1" : "0"}
                data-empty={album ? "0" : "1"}
                data-add={canAdd ? "1" : "0"}
                data-dragover={dragOverDate === dayKey ? "1" : "0"}
                // Drag a logged album onto any in-month day: empty → move,
                // filled → swap the two albums' dates.
                draggable={Boolean(album)}
                onDragStart={
                  album
                    ? (e) => {
                        e.dataTransfer.setData(
                          "text/plain",
                          JSON.stringify({ id: album.id, from: album.date }),
                        );
                        e.dataTransfer.effectAllowed = "move";
                      }
                    : undefined
                }
                onDragOver={
                  inMonth
                    ? (e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                        setDragOverDate(dayKey);
                      }
                    : undefined
                }
                onDragLeave={
                  inMonth
                    ? () => setDragOverDate((cur) => (cur === dayKey ? null : cur))
                    : undefined
                }
                onDrop={
                  inMonth
                    ? (e) => {
                        e.preventDefault();
                        setDragOverDate(null);
                        try {
                          const { from } = JSON.parse(
                            e.dataTransfer.getData("text/plain"),
                          ) as { id: string; from: string };
                          if (from) onMove(from, dayKey);
                        } catch {
                          /* ignore non-album drops */
                        }
                      }
                    : undefined
                }
                onClick={() => {
                  if (album) onOpen(album);
                  else if (canAdd) onAdd(fmtDate(d));
                }}
                // Disable cells with no action (out-of-month, or in-month future
                // empties) so they don't become keyboard tab stops; only album
                // (open) and canAdd (log) cells stay focusable.
                disabled={!album && !canAdd}
              >
                {inMonth && (
                  <>
                    <div className="dom-month-cal-date">
                      <span className="dom-month-cal-num">{d.getDate()}</span>
                      <span className="dom-month-cal-date-right">
                        {isToday && <span className="dom-month-cal-today">{t("common.today")}</span>}
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
                          <div className="dom-from">{t("common.fromAlbum", { title: album.albumTitle })}</div>
                        )}
                      </div>
                    )}
                    {canAdd && (
                      <div className="dom-month-cal-add">
                        <span className="dom-month-cal-add-mark">＋</span>
                        <span className="dom-month-cal-add-lbl">{t("common.logShort")}</span>
                      </div>
                    )}
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
