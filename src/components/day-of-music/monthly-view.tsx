// monthly-view.tsx — Monthly Overview: editorial calendar with featured picks.

import { useState } from "react";
import dayjs from "dayjs";

import {
  // DOW, — used only by the temporarily-disabled feature section below
  DOW_KO,
  // MONTHS,
  MONTHS_LONG,
  addDays,
  fmtDate,
  normalizeGenre,
  // parseDate,
  startOfWeek,
  type Album,
} from "@/lib/day-of-music/data";
import { useJournal } from "@/lib/day-of-music/use-journal";
import { Button } from "@/components/day-of-music/atoms";
import { Cover } from "@/components/day-of-music/cover";

export function MonthlyView({
  anchor,
  today,
  onOpen,
  onAdd,
  onPrev,
  onNext,
  onJump,
  onShare,
  onMove,
}: {
  /** Any day inside the month being viewed. */
  anchor: Date;
  today: Date;
  onOpen: (album: Album) => void;
  /** Open the add-flow with this YYYY-MM-DD preselected (empty in-month days). */
  onAdd: (date: string) => void;
  onPrev: () => void;
  onNext: () => void;
  onJump: (date: Date) => void;
  /** Open the shareable image of this month. */
  onShare: () => void;
  /** Reschedule via drag-and-drop. Dropping on an empty day moves the album;
   *  dropping on a filled day swaps the two albums' dates. */
  onMove: (fromDate: string, toDate: string) => void;
}) {
  const { albums, albumsByDate } = useJournal();
  // Date currently hovered as a drag-and-drop target (for highlight).
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  // The month being viewed follows `anchor`; `today` is only for highlighting.
  const current = dayjs(anchor);
  const year = current.year();
  const month = current.month();
  const isCurrentMonth =
    dayjs(today).month() === month && dayjs(today).year() === year;

  // Mon-start month grid (5–6 rows).
  const lastOfMonth = current.endOf("month");
  const calStart = startOfWeek(current.startOf("month").toDate());
  const numWeeks = Math.ceil((lastOfMonth.diff(dayjs(calStart), "day") + 1) / 7);
  const totalDays = numWeeks * 7;
  const days = Array.from({ length: totalDays }, (_, i) => addDays(calStart, i));

  const monthAlbums = albums.filter((a) => {
    const d = dayjs(a.date);
    return d.month() === month && d.year() === year;
  });

  // Feature section temporarily disabled (to be moved elsewhere):
  // const featured = monthAlbums.filter((a) => a.rating === 5);
  // const heroPick = featured[0] ?? monthAlbums[0];
  // const restFeatured = featured.slice(1, 4);

  const totalLogged = monthAlbums.length;
  const completion = Math.round((totalLogged / lastOfMonth.date()) * 100);
  const genreCount = new Set(monthAlbums.map((a) => normalizeGenre(a.genre)).filter(Boolean)).size;
  // Average rating across the month (mirrors the share card). "—" when empty.
  const avgRating = monthAlbums.length
    ? (monthAlbums.reduce((s, a) => s + a.rating, 0) / monthAlbums.length).toFixed(1)
    : "—";

  return (
    <div className="dom-month">
      <div className="dom-month-hd">
        <div className="dom-month-hd-left">
          <span className="dom-eyebrow">
            한 달의 청음 · {MONTHS_LONG[month].toLowerCase()} in listening
          </span>
          <h1 className="dom-month-h1">
            <span className="dom-month-h1-name">{MONTHS_LONG[month]}</span>
            <span className="dom-month-h1-year">{year}</span>
          </h1>
        </div>
        <div className="dom-month-nav">
          <button className="dom-wp-nav" onClick={onPrev} aria-label="Previous month">
            ←
          </button>
          <button className="dom-wp-nav" onClick={onNext} aria-label="Next month">
            →
          </button>
          {!isCurrentMonth && (
            <Button onClick={() => onJump(today)}>THIS MONTH</Button>
          )}
          <Button onClick={onShare}>SHARE MONTH</Button>
        </div>
        <div className="dom-month-hd-right">
          <div className="dom-month-stat">
            <span className="dom-month-stat-num">
              <i className="dom-month-stat-star">★</i> {avgRating}
            </span>
            <span className="dom-month-stat-lbl">avg rating · 평균 별점</span>
          </div>
          <div className="dom-month-stat">
            <span className="dom-month-stat-num">{String(totalLogged).padStart(2, "0")}</span>
            <span className="dom-month-stat-lbl">albums logged · 기록한 앨범</span>
          </div>
          <div className="dom-month-stat">
            <span className="dom-month-stat-num">
              {completion}
              <i>%</i>
            </span>
            <span className="dom-month-stat-lbl">of the month · 한 달의 비율</span>
          </div>
          <div className="dom-month-stat">
            <span className="dom-month-stat-num">{genreCount}</span>
            <span className="dom-month-stat-lbl">genres · 장르</span>
          </div>
        </div>
      </div>

      {/* PICK OF THE MONTH / ALSO FIVE-STARS — temporarily disabled, to be moved
          elsewhere. Re-enable the DOW / MONTHS / parseDate imports and the
          featured / heroPick / restFeatured vars above when restoring.
      {heroPick && (
        <div className="dom-month-feature">
          <div
            className="dom-month-feature-hero"
            onClick={() => onOpen(heroPick)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") onOpen(heroPick);
            }}
          >
            <Cover album={heroPick} size={280} />
            <div className="dom-month-feature-meta">
              <div className="dom-feature-eyebrow">★ pick of the month · 이달의 픽</div>
              <div className="dom-feature-title">{heroPick.title}</div>
              <div className="dom-feature-artist">
                {heroPick.artist}
                {heroPick.titleKo && <span> · {heroPick.titleKo}</span>}
              </div>
              <p className="dom-feature-note">&ldquo;{heroPick.note}&rdquo;</p>
              <div className="dom-feature-meta-line">
                <span>{heroPick.genre}</span>
                <span className="dom-dot">·</span>
                <span>{heroPick.year}</span>
                <span className="dom-dot">·</span>
                <span>
                  {String(parseDate(heroPick.date).getDate()).padStart(2, "0")} {MONTHS[month]}
                </span>
              </div>
            </div>
          </div>
          {restFeatured.length > 0 && (
            <div className="dom-month-feature-side">
              <div className="dom-feature-side-label">also five-stars · 다섯별</div>
              {restFeatured.map((a) => (
                <button key={a.id} className="dom-feature-side-item" onClick={() => onOpen(a)}>
                  <Cover album={a} size={72} />
                  <div>
                    <div className="dom-feature-side-title">{a.title}</div>
                    <div className="dom-feature-side-artist">{a.artist}</div>
                  </div>
                  <div className="dom-feature-side-date">
                    <span>{String(parseDate(a.date).getDate()).padStart(2, "0")}</span>
                    <span className="dom-feature-side-dow">{DOW[parseDate(a.date).getDay()]}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      */}

      <div className="dom-month-cal">
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
          style={{ gridTemplateRows: `repeat(${numWeeks}, minmax(140px, auto))` }}
        >
          {days.map((d, i) => {
            const inMonth = d.getMonth() === month;
            // Days outside the viewed month are blacked out — no album, no
            // date, nothing leaking in from the neighbouring month.
            const album = inMonth ? albumsByDate[fmtDate(d)] : undefined;
            const isToday = fmtDate(d) === fmtDate(today);
            const isFuture = d > today;
            // Empty in-month days up to today get a "+ log" affordance, like the
            // week view. Future days stay blank (can't log ahead).
            const canAdd = inMonth && !album && !isFuture;
            const dayKey = fmtDate(d);
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
                        {isToday && <span className="dom-month-cal-today">TODAY</span>}
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
                    {canAdd && (
                      <div className="dom-month-cal-add">
                        <span className="dom-month-cal-add-mark">＋</span>
                        <span className="dom-month-cal-add-lbl">log · 기록</span>
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
