// stats-share-card.tsx — Share Card: a shareable poster of recap stats.
// Builds a StatsSharePayload snapshot from the computed stats and renders the
// poster from it (share-posters.tsx), so the copied public link shows exactly
// this card. Shown inside the usual share chrome (scrim / poster / Copy link +
// Save image, like Share Week and Share Month).

"use client";

import { useMemo, useRef } from "react";

import { type AlbumStats } from "@/lib/day-of-music/album-stats";
import { DEFAULT_USERNAME, useProfile } from "@/lib/day-of-music/profile";
import { type JournalAlbum } from "@/lib/day-of-music/use-journal";
import { saveCardAsImage, shareFileName } from "@/lib/day-of-music/save-card";
import { buildStatsSharePayload } from "@/lib/day-of-music/share-links";
import { StatsPoster } from "@/components/day-of-music/share-posters";
import { PosterFit } from "@/components/day-of-music/poster-fit";
import { ShareActions } from "@/components/day-of-music/share-actions";
import { Modal } from "@/components/day-of-music/modal";

export function StatsShareCard({
  title,
  themeLabel,
  sub,
  stats,
  showFives = false,
  filenameParts,
  onClose,
}: {
  /** Poster headline, e.g. "2026 · Year in Music" or the theme's name. */
  title: string;
  /** Meta chip next to @username, e.g. "🎧 Daily" or "1 theme lane". */
  themeLabel: string;
  /** Line under the albums count, e.g. "across 1 theme lane · 183 days". */
  sub: string;
  stats: AlbumStats<JournalAlbum>;
  /** Theme cards list their five-star albums; the year card stays stats-only. */
  showFives?: boolean;
  filenameParts: (string | number)[];
  onClose: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const { username } = useProfile();

  const payload = useMemo(
    () =>
      buildStatsSharePayload({
        title,
        username: username.trim() || DEFAULT_USERNAME,
        themeLabel,
        sub,
        showFives,
        stats,
      }),
    [title, username, themeLabel, sub, showFives, stats],
  );

  function handleSaveImage() {
    if (!cardRef.current) return;
    void saveCardAsImage(cardRef.current, shareFileName(filenameParts));
  }

  return (
    <Modal label="SHARE CARD" onClose={onClose} className="dom-share">
      <PosterFit>
        <StatsPoster payload={payload} ref={cardRef} />
      </PosterFit>
      <ShareActions payload={payload} onSaveImage={handleSaveImage} />
    </Modal>
  );
}
