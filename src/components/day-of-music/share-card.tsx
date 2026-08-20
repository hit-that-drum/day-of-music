// share-card.tsx — Share Week: a shareable poster of the current week.
// Builds a WeekSharePayload snapshot from live journal state and renders the
// poster from it (share-posters.tsx), so the copied public link shows exactly
// this card. The poster body mirrors the Weekly Grid (same .dom-grid/.dom-day
// markup), so the saved image matches what the user sees on the week board.

"use client";

import { useMemo, useRef } from "react";

import {
  DOW,
  MONTHS_LONG,
  fmtDate,
  normalizeGenre,
  weekOfMonth,
} from "@/lib/day-of-music/data";
import { useJournal } from "@/lib/day-of-music/use-journal";
import { DEFAULT_USERNAME, useProfile } from "@/lib/day-of-music/profile";
import { useActiveTheme, useThemes } from "@/lib/day-of-music/themes";
import { saveCardAsImage, shareFileName } from "@/lib/day-of-music/save-card";
import {
  readShareTheme,
  sanitizeAlbum,
  type WeekSharePayload,
} from "@/lib/day-of-music/share-links";
import { WeekPoster } from "@/components/day-of-music/share-posters";
import { PosterFit } from "@/components/day-of-music/poster-fit";
import { ShareActions } from "@/components/day-of-music/share-actions";
import { Modal } from "@/components/day-of-music/modal";

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

  const payload = useMemo<WeekSharePayload>(() => {
    const isOutOfMonth = (d: Date) =>
      splitByMonth && (d.getMonth() !== labelMonth || d.getFullYear() !== labelYear);

    // One entry per visible day, mirroring the weekly grid (album, blank, or
    // out-of-month). Out-of-month days never carry an album.
    const cells = days.slice(0, 7).map((d) => {
      const outOfMonth = isOutOfMonth(d);
      const album = outOfMonth ? undefined : albumsByDate[fmtDate(d)];
      return {
        date: fmtDate(d),
        dayNum: d.getDate(),
        dow: DOW[d.getDay()],
        outOfMonth,
        album: album ? sanitizeAlbum(album) : undefined,
      };
    });

    // Footer stats only count albums that belong to the labelled month.
    const week = cells.flatMap((c) => (c.album ? [c.album] : []));
    const genreCount = new Set(week.map((a) => normalizeGenre(a.genre)).filter(Boolean)).size;
    const avg = week.length
      ? (week.reduce((s, a) => s + a.rating, 0) / week.length).toFixed(1)
      : "—";

    return {
      v: 1,
      kind: "week",
      title: `${monthLabel} · Week ${weekNum}`,
      username: username.trim() || DEFAULT_USERNAME,
      themeLabel: themeEmoji ? `${themeEmoji} ${themeName}` : themeName,
      theme: readShareTheme(),
      cells,
      stats: { count: week.length, genres: genreCount, avg },
    };
  }, [
    days,
    splitByMonth,
    labelMonth,
    labelYear,
    albumsByDate,
    monthLabel,
    weekNum,
    username,
    themeEmoji,
    themeName,
  ]);

  function handleSaveImage() {
    if (!cardRef.current) return;
    void saveCardAsImage(cardRef.current, shareFileName([themeName, monthLabel, weekNum]));
  }

  return (
    <Modal label="SHARE WEEK" onClose={onClose} className="dom-share">
      <PosterFit>
        <WeekPoster payload={payload} ref={cardRef} />
      </PosterFit>
      <ShareActions payload={payload} onSaveImage={handleSaveImage} />
    </Modal>
  );
}
