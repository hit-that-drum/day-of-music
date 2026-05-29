// share-card.tsx — Share Week: a shareable poster of the current week.

"use client";

import { useRef } from "react";
import { toPng } from "html-to-image";
import { toast } from "sonner";

import { MONTHS_LONG, fmtDate, weekOfMonth, type Album } from "@/lib/day-of-music/data";
import { useJournal } from "@/lib/day-of-music/use-journal";
import { Cover } from "@/components/day-of-music/cover";

export function ShareCard({
  weekStart,
  days,
  onClose,
}: {
  weekStart: Date;
  days: Date[];
  onClose: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const { albumsByDate } = useJournal();

  const monthLabel = MONTHS_LONG[weekStart.getMonth()];
  const weekNum = weekOfMonth(weekStart);
  const week = days
    .slice(0, 7)
    .map((d) => albumsByDate[fmtDate(d)])
    .filter((a): a is Album => Boolean(a));

  const genreCount = new Set(week.map((a) => a.genre)).size;
  const avg = week.length
    ? (week.reduce((s, a) => s + a.rating, 0) / week.length).toFixed(1)
    : "—";

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy link");
    }
  }

  async function handleSaveImage() {
    if (!cardRef.current) return;
    try {
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 2, cacheBust: true });
      const link = document.createElement("a");
      link.download = `day-of-music-${monthLabel.toLowerCase()}-week-${weekNum}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("Image saved");
    } catch {
      toast.error("Couldn't save image");
    }
  }

  return (
    <div className="dom-scrim" onClick={onClose} role="dialog" aria-modal="true" aria-label="Share week">
      <div className="dom-share" onClick={(e) => e.stopPropagation()}>
        <button className="dom-detail-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <div className="dom-share-card" ref={cardRef}>
          <div className="dom-share-hd">
            <div>
              <div className="dom-share-eyebrow">DAY · OF · MUSIC</div>
              <div className="dom-share-title">
                {monthLabel} · Week {weekNum}
              </div>
            </div>
            <div className="dom-share-meta">@listener</div>
          </div>
          <div className="dom-share-grid">
            {week.map((a) => (
              <div key={a.id} className="dom-share-cell">
                <div>
                  <Cover album={a} size="100%" />
                </div>
                <div className="dom-share-cell-title">{a.title}</div>
                <div className="dom-share-cell-artist">{a.artist}</div>
              </div>
            ))}
          </div>
          <div className="dom-share-ft">
            <div>
              {week.length} albums · {genreCount} genres
            </div>
            <div>★ {avg}</div>
          </div>
        </div>
        <div className="dom-share-actions">
          <button className="dom-btn dom-btn-ghost" onClick={handleCopyLink}>
            Copy link
          </button>
          <button className="dom-btn" onClick={handleSaveImage}>
            Save image
          </button>
        </div>
      </div>
    </div>
  );
}
