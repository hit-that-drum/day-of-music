// share-posters.tsx — the three share posters, rendered purely from a
// SharePayload snapshot (no hooks, no providers). The share-card modals build
// the payload from live journal state; the public /s pages feed the same
// payload back from a stored (or URL-encoded) snapshot — one renderer, so the
// copied link can never drift from what the sharer saw.

import type { Ref } from "react";

import type { Album } from "@/lib/day-of-music/data";
import type {
  MonthSharePayload,
  SharedAlbum,
  StatsSharePayload,
  WeekSharePayload,
} from "@/lib/day-of-music/share-links";
import { Cover } from "@/components/day-of-music/cover";
import { MetaLine, Stars } from "@/components/day-of-music/atoms";

// Cover/MetaLine take a full Album; a snapshot album just lacks the fields
// that never leave the device (note, tracks).
function toAlbum(a: SharedAlbum): Album {
  return { ...a, note: "", tracks: [] };
}

function PosterHeader({
  title,
  username,
  themeLabel,
}: {
  title: string;
  username: string;
  themeLabel: string;
}) {
  return (
    <div className="dom-share-hd">
      <div>
        <div className="dom-share-eyebrow">DAY · OF · MUSIC</div>
        <div className="dom-share-title">{title}</div>
      </div>
      <div className="dom-share-meta">
        {/* The payload builders resolve the username fallback, so the poster
            renders it verbatim (keeps this file free of client-module imports). */}
        <span className="dom-share-user">@{username}</span>
        <span className="dom-share-theme">{themeLabel}</span>
      </div>
    </div>
  );
}

function PosterFooter({ count, genres, avg }: { count: number; genres: number; avg: string }) {
  return (
    <div className="dom-share-ft">
      <div>
        {count} albums · {genres} genres
      </div>
      <div className="dom-day-album-rating">
        <span>★</span> {avg}
      </div>
    </div>
  );
}

export function WeekPoster({
  payload,
  ref,
}: {
  payload: WeekSharePayload;
  ref?: Ref<HTMLDivElement>;
}) {
  return (
    <div className="dom-share-card" ref={ref}>
      <PosterHeader {...payload} />

      {/* Week grid — identical markup/classes to the weekly board. */}
      <div
        className="dom-grid dom-share-week"
        style={{ ["--cols" as string]: payload.cells.length }}
      >
        {payload.cells.map(({ date, dayNum, dow, outOfMonth, album }) => (
          <div
            key={date}
            className="dom-day"
            data-empty={album ? "0" : "1"}
            data-outmonth={outOfMonth ? "1" : "0"}
          >
            <div className="dom-day-hd">
              <span className="dom-day-num">{dayNum}</span>
              <span className="dom-day-bar">|</span>
              <span className="dom-day-dow">{dow}</span>
              <span className="dom-day-album-rating">
                <span>★</span>
                {album?.rating}
              </span>
            </div>
            {outOfMonth ? (
              <div className="dom-day-body dom-day-empty dom-day-blank" aria-hidden="true" />
            ) : album ? (
              <div className="dom-day-body">
                <div className="dom-cover-wrap">
                  <Cover album={toAlbum(album)} size="100%" />
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
                  <MetaLine album={toAlbum(album)} />
                </div>
              </div>
            ) : (
              <div className="dom-day-body dom-day-empty" />
            )}
          </div>
        ))}
      </div>

      <PosterFooter {...payload.stats} />
    </div>
  );
}

const MONTH_DOW = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;
const MONTH_DOW_KO = ["월", "화", "수", "목", "금", "토", "일"] as const;

export function MonthPoster({
  payload,
  ref,
}: {
  payload: MonthSharePayload;
  ref?: Ref<HTMLDivElement>;
}) {
  return (
    <div className="dom-share-card dom-share-card-month" ref={ref}>
      <PosterHeader {...payload} />

      {/* Month grid — identical markup/classes to the monthly board. */}
      <div className="dom-month-cal dom-share-monthcal">
        <div className="dom-month-cal-hd">
          {MONTH_DOW.map((d, i) => (
            <div key={d} className="dom-month-cal-dow">
              <span>{d}</span>
              <span className="dom-month-cal-dowKo">{MONTH_DOW_KO[i]}</span>
            </div>
          ))}
        </div>
        <div
          className="dom-month-cal-grid"
          style={{ gridTemplateRows: `repeat(${payload.numWeeks}, minmax(120px, auto))` }}
        >
          {payload.cells.map(({ dayNum, inMonth, album }, i) => (
            <div
              key={i}
              className="dom-month-cal-cell"
              data-inmonth={inMonth ? "1" : "0"}
              data-empty={album ? "0" : "1"}
            >
              {inMonth && (
                <>
                  <div className="dom-month-cal-date">
                    <span className="dom-month-cal-num">{dayNum}</span>
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
                      <Cover album={toAlbum(album)} size="100%" />
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
          ))}
        </div>
      </div>

      <PosterFooter {...payload.stats} />
    </div>
  );
}

export function StatsPoster({
  payload,
  ref,
}: {
  payload: StatsSharePayload;
  ref?: Ref<HTMLDivElement>;
}) {
  const { stats, sub, showFives } = payload;
  // Every five-star album goes on the poster — the card just grows taller and
  // the export captures the full node, not the viewport.
  const fives = showFives ? stats.fives : [];

  return (
    <div className="dom-share-card dom-share-card-stats" ref={ref}>
      <PosterHeader {...payload} />

      {/* Stats — identical card markup/classes to the My Logs recap. */}
      <div className="dom-theme-recap-grid">
        <div className="dom-stat dom-stat-compact">
          <div className="dom-stat-label">albums</div>
          <div className="dom-stat-num">{String(stats.total).padStart(2, "0")}</div>
          <div className="dom-stat-sub">{sub}</div>
        </div>
        <div className="dom-stat dom-stat-compact">
          <div className="dom-stat-label">average</div>
          <div className="dom-stat-num">{stats.avgRating}</div>
          <div className="dom-stat-sub">
            <Stars value={Math.round(stats.avgRatingNum)} size={13} />
          </div>
        </div>
        <div className="dom-stat dom-stat-compact">
          <div className="dom-stat-label">five-stars</div>
          <div className="dom-stat-num">{stats.fives.length}</div>
          <div className="dom-stat-sub">
            {stats.total ? Math.round((stats.fives.length / stats.total) * 100) : 0}% of catalog
          </div>
        </div>
        <div className="dom-stat dom-stat-compact dom-theme-genre-card">
          <div className="dom-stat-label">top genres</div>
          <div className="dom-bars">
            {stats.topGenres.length ? (
              stats.topGenres.map(([g, n]) => (
                <div key={g} className="dom-bar">
                  <span className="dom-bar-label">{g}</span>
                  <div className="dom-bar-track">
                    <div
                      className="dom-bar-fill"
                      style={{ width: `${(n / stats.total) * 100}%` }}
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

      {fives.length > 0 && (
        <div className="dom-share-fives">
          <div className="dom-theme-fives-title">Five stars · 다섯별 앨범</div>
          {/* Same item markup as the recap modal's fives list, so each
              album carries its info (title · artist) on the poster too. */}
          <div className="dom-fives dom-fives-compact">
            {fives.map((a) => (
              <div key={`${a.theme}:${a.date}:${a.id}`} className="dom-fives-item">
                <div>
                  <Cover album={toAlbum(a)} size="100%" />
                </div>
                <div className="dom-fives-info">
                  <div className="dom-fives-title">{a.title}</div>
                  <div className="dom-fives-artist">{a.artist}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="dom-share-ft">
        <div>
          {stats.total} albums · {stats.genreCount} genres
        </div>
        <div className="dom-day-album-rating">
          <span>★</span>
          {stats.total ? stats.avgRatingNum.toFixed(1) : "—"}
        </div>
      </div>
    </div>
  );
}
