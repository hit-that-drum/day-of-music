// journal-rail.tsx — the right-hand Journal rail (desktop only).

import { fmtDate, parseDate, type Album } from "@/lib/day-of-music/data";
import { useJournal } from "@/lib/day-of-music/use-journal";
import { Cover } from "@/components/day-of-music/cover";
import { Stars } from "@/components/day-of-music/atoms";

export function JournalRail({
  today,
  onOpen,
}: {
  today: Date;
  onOpen: (album: Album) => void;
}) {
  const { albums, albumsByDate } = useJournal();
  const todayAlbum = albumsByDate[fmtDate(today)];
  const recent = albums
    .filter((a) => parseDate(a.date) <= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-4)
    .reverse();

  if (!todayAlbum) return null;

  return (
    <aside className="dom-rail">
      <div className="dom-rail-section">
        <div className="dom-rail-eyebrow">today · 오늘의 앨범</div>
        <button className="dom-rail-today" onClick={() => onOpen(todayAlbum)}>
          <div>
            <Cover album={todayAlbum} size={220} />
          </div>
          <div className="dom-rail-today-info">
            <div className="dom-rail-today-title">{todayAlbum.title}</div>
            <div className="dom-rail-today-artist">{todayAlbum.artist}</div>
            <div style={{ marginTop: 6 }}>
              <Stars value={todayAlbum.rating} size={12} />
            </div>
          </div>
        </button>
      </div>

      <div className="dom-rail-section">
        <div className="dom-rail-eyebrow">my note · 메모</div>
        <p className="dom-rail-note">&ldquo;{todayAlbum.note}&rdquo;</p>
      </div>

      <div className="dom-rail-section">
        <div className="dom-rail-eyebrow">recent · 최근</div>
        <div className="dom-rail-recent">
          {recent.map((a) => (
            <button key={a.id} className="dom-rail-recent-row" onClick={() => onOpen(a)}>
              <div>
                <Cover album={a} size={40} />
              </div>
              <div>
                <div className="dom-rail-recent-title">{a.title}</div>
                <div className="dom-rail-recent-artist">{a.artist}</div>
              </div>
              <div className="dom-rail-recent-date">
                {String(parseDate(a.date).getDate()).padStart(2, "0")}
              </div>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
