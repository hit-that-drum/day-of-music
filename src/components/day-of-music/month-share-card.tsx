// month-share-card.tsx — Share Month: a shareable poster of the month calendar.
// Builds a MonthSharePayload snapshot from live journal state and renders the
// poster from it (share-posters.tsx), so the copied public link shows exactly
// this card. The poster mirrors the monthly board grid (same .dom-month-cal
// markup), so the saved image matches what the user sees.

"use client";

import { useMemo, useRef } from "react";

import { MONTHS_LONG } from "@/lib/day-of-music/data";
import { useJournal } from "@/lib/day-of-music/use-journal";
import { displayHandle, useProfile } from "@/lib/day-of-music/profile";
import { formatThemeLabel, useActiveThemeObject } from "@/lib/day-of-music/themes";
import { saveCardAsImage, shareFileName } from "@/lib/day-of-music/save-card";
import { buildMonthSharePayload } from "@/lib/day-of-music/share-links";
import { MonthPoster } from "@/components/day-of-music/share-posters";
import { PosterFit } from "@/components/day-of-music/poster-fit";
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
  const activeTheme = useActiveThemeObject();
  const themeName = activeTheme.name;
  const themeLabel = formatThemeLabel(activeTheme);

  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const monthLabel = MONTHS_LONG[month];

  const payload = useMemo(
    () =>
      buildMonthSharePayload({
        anchor,
        albums,
        albumsByDate,
        username: displayHandle(username),
        themeLabel,
      }),
    [anchor, albums, albumsByDate, username, themeLabel],
  );

  async function handleSaveImage() {
    if (!cardRef.current) return false;
    return saveCardAsImage(cardRef.current, shareFileName([themeName, monthLabel, year]));
  }

  return (
    <Modal label="SHARE MONTH" onClose={onClose} className="dom-share dom-share-month">
      <PosterFit>
        <MonthPoster payload={payload} ref={cardRef} />
      </PosterFit>
      <ShareActions payload={payload} onSaveImage={handleSaveImage} />
    </Modal>
  );
}
