// month-share-card.tsx — Share Month: a shareable poster of the month calendar.
// Builds a MonthSharePayload snapshot from live journal state and renders the
// poster from it (share-posters.tsx), so the copied public link shows exactly
// this card. The poster mirrors the monthly board grid (same .dom-month-cal
// markup), so the saved image matches what the user sees.

"use client";

import { useMemo, useRef } from "react";
import dayjs from "dayjs";

import {
  MONTHS_LONG,
  addDays,
  fmtDate,
  normalizeGenre,
  startOfWeek,
} from "@/lib/day-of-music/data";
import { useJournal } from "@/lib/day-of-music/use-journal";
import { DEFAULT_USERNAME, useProfile } from "@/lib/day-of-music/profile";
import { useActiveTheme, useThemes } from "@/lib/day-of-music/themes";
import { saveCardAsImage, shareFileName } from "@/lib/day-of-music/save-card";
import {
  readShareTheme,
  sanitizeAlbum,
  type MonthSharePayload,
} from "@/lib/day-of-music/share-links";
import { MonthPoster } from "@/components/day-of-music/share-posters";
import { ShareActions } from "@/components/day-of-music/share-actions";
import { Modal } from "@/components/day-of-music/modal";

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

  const year = dayjs(anchor).year();
  const month = dayjs(anchor).month();
  const monthLabel = MONTHS_LONG[month];

  const payload = useMemo<MonthSharePayload>(() => {
    const current = dayjs(anchor);
    const lastOfMonth = current.endOf("month");
    const calStart = startOfWeek(current.startOf("month").toDate());
    const numWeeks = Math.ceil((lastOfMonth.diff(dayjs(calStart), "day") + 1) / 7);
    const days = Array.from({ length: numWeeks * 7 }, (_, i) => addDays(calStart, i));

    const cells = days.map((d) => {
      const inMonth = d.getMonth() === month;
      const album = inMonth ? albumsByDate[fmtDate(d)] : undefined;
      return {
        dayNum: d.getDate(),
        inMonth,
        album: album ? sanitizeAlbum(album) : undefined,
      };
    });

    const monthAlbums = albums.filter((a) => {
      const d = dayjs(a.date);
      return d.month() === month && d.year() === year;
    });
    const genreCount = new Set(
      monthAlbums.map((a) => normalizeGenre(a.genre)).filter(Boolean),
    ).size;
    const avg = monthAlbums.length
      ? (monthAlbums.reduce((s, a) => s + a.rating, 0) / monthAlbums.length).toFixed(1)
      : "—";

    return {
      v: 1,
      kind: "month",
      title: `${monthLabel} · ${year}`,
      username: username.trim() || DEFAULT_USERNAME,
      themeLabel: themeEmoji ? `${themeEmoji} ${themeName}` : themeName,
      theme: readShareTheme(),
      numWeeks,
      cells,
      stats: { count: monthAlbums.length, genres: genreCount, avg },
    };
  }, [anchor, month, year, monthLabel, albums, albumsByDate, username, themeEmoji, themeName]);

  function handleSaveImage() {
    if (!cardRef.current) return;
    void saveCardAsImage(cardRef.current, shareFileName([themeName, monthLabel, year]));
  }

  return (
    <Modal label="SHARE MONTH" onClose={onClose} className="dom-share dom-share-month">
      <MonthPoster payload={payload} ref={cardRef} />
      <ShareActions payload={payload} onSaveImage={handleSaveImage} />
    </Modal>
  );
}
