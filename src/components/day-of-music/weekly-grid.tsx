// weekly-grid.tsx — the Weekly Grid screen: header + 7-day grid of day cells.

import {
  DOW,
  DOW_KO,
  MONTHS_LONG,
  fmtDate,
  weekOfMonth,
  type Album,
} from "@/lib/day-of-music/data";
import { useJournal } from "@/lib/day-of-music/use-journal";
import { Cover } from "@/components/day-of-music/cover";
import { MetaLine } from "@/components/day-of-music/atoms";

type WeeklyGridProps = {
  days: Date[];
  weekStart: Date;
  today: Date;
  onOpen: (album: Album) => void;
  onPrev: () => void;
  onNext: () => void;
  onShare: () => void;
};

export function WeeklyGrid({
  days,
  weekStart,
  today,
  onOpen,
  onPrev,
  onNext,
  onShare,
}: WeeklyGridProps) {
  const { albumsByDate } = useJournal();
  const monthLabel = MONTHS_LONG[weekStart.getMonth()];
  const weekNum = weekOfMonth(weekStart);

  return (
    <div className="dom-week">
      <WeekHeader
        monthLabel={monthLabel}
        weekNum={weekNum}
        onPrev={onPrev}
        onNext={onNext}
        onShare={onShare}
      />
      <div className="dom-grid">
        {/* Label cell — only visible in the 2-column mobile grid. */}
        <div className="dom-grid-label">
          <div className="dom-grid-label-inner">
            <div className="dom-month-name">{monthLabel.toUpperCase()}</div>
            <div className="dom-month-sub">— Week {weekNum}</div>
            <div className="dom-month-tag">{weekStart.getFullYear()} · 큐레이션</div>
          </div>
        </div>
        {days.map((d, i) => {
          const album = albumsByDate[fmtDate(d)];
          const isToday = fmtDate(d) === fmtDate(today);
          const isFuture = d > today;
          return (
            <DayCell
              key={i}
              date={d}
              album={album}
              isToday={isToday}
              isFuture={isFuture}
              onOpen={onOpen}
            />
          );
        })}
      </div>
    </div>
  );
}

function WeekHeader({
  monthLabel,
  weekNum,
  onPrev,
  onNext,
  onShare,
}: {
  monthLabel: string;
  weekNum: number;
  onPrev: () => void;
  onNext: () => void;
  onShare: () => void;
}) {
  return (
    <div className="dom-week-hd">
      <div className="dom-week-title">
        <span className="dom-eyebrow">큐레이션 · weekly view</span>
        <h1>
          {monthLabel}
          <span className="dom-week-title-break"> — Week {weekNum}</span>
        </h1>
      </div>
      <div className="dom-week-actions">
        <button className="dom-iconbtn" onClick={onPrev} aria-label="Previous week">
          ←
        </button>
        <button className="dom-iconbtn" onClick={onNext} aria-label="Next week">
          →
        </button>
        <button className="dom-btn" onClick={onShare}>
          Share week
        </button>
      </div>
    </div>
  );
}

function DayCell({
  date,
  album,
  isToday,
  isFuture,
  onOpen,
}: {
  date: Date;
  album: Album | undefined;
  isToday: boolean;
  isFuture: boolean;
  onOpen: (album: Album) => void;
}) {
  const day = date.getDate();
  const dow = DOW[date.getDay()];
  const dowKo = DOW_KO[date.getDay()];

  return (
    <div
      className="dom-day"
      data-today={isToday ? "1" : "0"}
      data-future={isFuture ? "1" : "0"}
      data-empty={album ? "0" : "1"}
    >
      <div className="dom-day-hd">
        <span className="dom-day-num">{day}</span>
        <span className="dom-day-bar">|</span>
        <span className="dom-day-dow">{dow}</span>
        <span className="dom-day-dowKo">{dowKo}</span>
      </div>
      {album ? (
        <button
          className="dom-day-body"
          onClick={() => onOpen(album)}
          aria-label={`Open ${album.title}`}
        >
          <div className="dom-cover-wrap" style={{ maxWidth: 220 }}>
            <Cover album={album} size="100%" />
          </div>
          <div className="dom-day-meta">
            <div className="dom-title">{album.title}</div>
            <div className="dom-artist">
              {album.artist}
              <span className="dom-artist-ko"> · {album.titleKo}</span>
            </div>
            <MetaLine album={album} />
          </div>
        </button>
      ) : (
        <div className="dom-day-body dom-day-empty" />
      )}
    </div>
  );
}
