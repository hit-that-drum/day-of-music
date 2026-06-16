// monthly-view.tsx — Monthly Overview: editorial calendar with featured picks.

import dayjs from "dayjs";

import {
  DOW,
  DOW_KO,
  MONTHS,
  MONTHS_LONG,
  addDays,
  fmtDate,
  parseDate,
  startOfWeek,
  type Album,
} from "@/lib/day-of-music/data";
import { useJournal } from "@/lib/day-of-music/use-journal";
import { Cover } from "@/components/day-of-music/cover";

export function MonthlyView({
  today,
  onOpen,
}: {
  today: Date;
  onOpen: (album: Album) => void;
}) {
  const { albums, albumsByDate } = useJournal();
  // The month being viewed follows `today`.
  const current = dayjs(today);
  const year = current.year();
  const month = current.month();

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

  const featured = monthAlbums.filter((a) => a.rating === 5);
  const heroPick = featured[0] ?? monthAlbums[0];
  const restFeatured = featured.slice(1, 4);

  const totalLogged = monthAlbums.length;
  const completion = Math.round((totalLogged / lastOfMonth.date()) * 100);
  const genreCount = new Set(monthAlbums.map((a) => a.genre)).size;

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
        <div className="dom-month-hd-right">
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
                {heroPick.artist} <span>· {heroPick.titleKo}</span>
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
            const album = albumsByDate[fmtDate(d)];
            const inMonth = d.getMonth() === month;
            const isToday = fmtDate(d) === fmtDate(today);
            return (
              <button
                key={i}
                className="dom-month-cal-cell"
                data-inmonth={inMonth ? "1" : "0"}
                data-today={isToday ? "1" : "0"}
                data-empty={album ? "0" : "1"}
                onClick={() => album && onOpen(album)}
                disabled={!album}
              >
                <div className="dom-month-cal-date">
                  <span className="dom-month-cal-num">{d.getDate()}</span>
                  {isToday && <span className="dom-month-cal-today">TODAY</span>}
                </div>
                {album && (
                  <div className="dom-month-cal-cover">
                    <Cover album={album} size="100%" />
                  </div>
                )}
                {album && (
                  <div className="dom-month-cal-info">
                    <div className="dom-month-cal-title">{album.title}</div>
                    <div className="dom-month-cal-artist">{album.artist}</div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
