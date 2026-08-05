// best-of-week-modal.tsx — "Best of Week": the days of one week segment enter
// the tournament (see best-of-modal.tsx), and the champion is persisted so Best
// of Month can later run over the weekly winners.

"use client";

import { useMemo } from "react";

import { MONTHS_LONG, fmtDate, weekOfMonth } from "@/lib/day-of-music/data";
import { useJournal } from "@/lib/day-of-music/use-journal";
import { useActiveTheme, useThemes, resolveActiveTheme } from "@/lib/day-of-music/themes";
import { useT } from "@/lib/day-of-music/i18n";
import { bestOfKey, weekContenders } from "@/lib/day-of-music/best-of";
import { shareFileName } from "@/lib/day-of-music/save-card";
import { BestOfModal } from "@/components/day-of-music/best-of-modal";

export function BestOfWeekModal({
  days,
  labelDate,
  splitByMonth,
  onClose,
}: {
  /** The full Mon–Sun strip (7 days). */
  days: Date[];
  /** The segment's label day — its first in-month day when split-by-month is on,
   *  otherwise the week's Monday. Drives the header label and the period key. */
  labelDate: Date;
  /** When true (split-by-month), only days in labelDate's month are contenders,
   *  so a month-straddling week is judged one in-month segment at a time. */
  splitByMonth: boolean;
  onClose: () => void;
}) {
  const t = useT();
  const { albumsByDate } = useJournal();
  const { themes } = useThemes();
  const { activeTheme } = useActiveTheme();

  const contenders = useMemo(
    () => weekContenders(days, albumsByDate, labelDate, splitByMonth),
    [days, albumsByDate, labelDate, splitByMonth],
  );

  const monthLabel = MONTHS_LONG[labelDate.getMonth()];
  const weekNum = weekOfMonth(labelDate);
  const theme = resolveActiveTheme(themes, activeTheme);
  const themeName = themes.find((x) => x.id === theme)?.name ?? "Daily";

  return (
    <BestOfModal
      contenders={contenders}
      // Period key = the segment's first in-view day: the week's Monday when
      // continuous, or the first in-month day when split — so the two segments
      // of a month-straddling week are judged and persisted independently.
      storeKey={bestOfKey("week", theme, fmtDate(labelDate))}
      title={t("bow.title")}
      periodLabel={`${monthLabel} · Week ${weekNum}`}
      championKicker={t("bow.champion")}
      emptyText={t("bow.empty")}
      emptyHint={t("bow.emptyHint")}
      fileName={shareFileName(["Best-of-Week", themeName, monthLabel, weekNum])}
      onClose={onClose}
    />
  );
}
