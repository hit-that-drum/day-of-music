// album-dnd.ts — dragging a logged album between days on the boards (the weekly
// grid and the monthly calendar). Both speak one protocol: the drag carries the
// album's id and current date, and dropping it on a day moves it there — or
// swaps it with the album already on that day (moveSlot decides).

import { useCallback, useState, type DragEvent } from "react";

import type { Album } from "@/lib/day-of-music/data";

/** Start dragging `album`, carrying what a drop target reads back. */
export function setAlbumDragData(e: DragEvent, album: Album): void {
  e.dataTransfer.setData("text/plain", JSON.stringify({ id: album.id, from: album.date }));
  e.dataTransfer.effectAllowed = "move";
}

/** The day the dropped album comes from; null for a drop that isn't an album
 *  (text or a file dragged in from elsewhere). */
export function readAlbumDragData(e: DragEvent): string | null {
  try {
    const { from } = JSON.parse(e.dataTransfer.getData("text/plain")) as { from?: unknown };
    return typeof from === "string" && from ? from : null;
  } catch {
    return null;
  }
}

/** Make the day `date` a drop target while `enabled`: highlighted while an
 *  album hovers it, and a drop moves the album from its day to this one. */
export function useAlbumDropTarget(
  date: string,
  enabled: boolean,
  onMove: (fromDate: string, toDate: string) => void,
) {
  const [dragOver, setDragOver] = useState(false);

  const onDragOver = useCallback(
    (e: DragEvent) => {
      if (!enabled) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDragOver(true);
    },
    [enabled],
  );
  // Only clear the highlight when the cursor actually leaves the cell — not when
  // it moves onto a child (album button, cover image), which would flicker it.
  const onDragLeave = useCallback((e: DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false);
  }, []);
  const onDrop = useCallback(
    (e: DragEvent) => {
      if (!enabled) return;
      e.preventDefault();
      setDragOver(false);
      const from = readAlbumDragData(e);
      if (from) onMove(from, date);
    },
    [enabled, onMove, date],
  );

  return { dragOver, dropHandlers: { onDragOver, onDragLeave, onDrop } };
}
