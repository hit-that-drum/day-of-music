// share-card.tsx — Share Week: a shareable poster of the current week.
// Builds a WeekSharePayload snapshot from live journal state and renders the
// poster from it (share-posters.tsx), so the copied public link shows exactly
// this card. The poster body mirrors the Weekly Grid (same .dom-grid/.dom-day
// markup), so the saved image matches what the user sees on the week board.

"use client";

import { useMemo, useRef } from "react";

import { MONTHS_LONG, weekOfMonth } from "@/lib/day-of-music/data";
import { useJournal } from "@/lib/day-of-music/use-journal";
import { displayHandle, useProfile } from "@/lib/day-of-music/profile";
import { formatThemeLabel, useActiveThemeObject } from "@/lib/day-of-music/themes";
import { saveCardAsImage, shareFileName } from "@/lib/day-of-music/save-card";
import { buildWeekSharePayload } from "@/lib/day-of-music/share-links";
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
  const activeTheme = useActiveThemeObject();
  const themeName = activeTheme.name;
  const themeLabel = formatThemeLabel(activeTheme);

  const monthLabel = MONTHS_LONG[weekStart.getMonth()];
  const weekNum = weekOfMonth(weekStart);

  // One cell per visible day, mirroring the weekly grid (see buildWeekSharePayload).
  const payload = useMemo(
    () =>
      buildWeekSharePayload({
        days,
        labelDate: weekStart,
        splitByMonth,
        albumsByDate,
        username: displayHandle(username),
        themeLabel,
      }),
    [days, weekStart, splitByMonth, albumsByDate, username, themeLabel],
  );

  async function handleSaveImage() {
    if (!cardRef.current) return false;
    return saveCardAsImage(cardRef.current, shareFileName([themeName, monthLabel, weekNum]));
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
