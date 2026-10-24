// best-of-month-modal.tsx — "Best of Month": the month's weekly champions play
// each other in the same bracket the week uses (see best-of-modal.tsx). The
// field comes from useBestOfMonthStatus, the single place that decides which
// weekly winners belong to this month.

"use client";

import { MONTHS_LONG } from "@/lib/day-of-music/data";
import { useActiveThemeObject } from "@/lib/day-of-music/themes";
import { useT } from "@/lib/day-of-music/i18n";
import { bestOfKey, monthKey, useBestOfMonthStatus } from "@/lib/day-of-music/best-of";
import { shareFileName } from "@/lib/day-of-music/save-card";
import { BestOfModal } from "@/components/day-of-music/best-of-modal";

export function BestOfMonthModal({
  anchor,
  splitByMonth,
  today,
  onClose,
}: {
  /** Any day inside the month being judged. */
  anchor: Date;
  splitByMonth: boolean;
  today: Date;
  onClose: () => void;
}) {
  const t = useT();
  const activeTheme = useActiveThemeObject();
  const { contenders } = useBestOfMonthStatus(anchor, splitByMonth, today);

  const monthLabel = MONTHS_LONG[anchor.getMonth()];
  const year = anchor.getFullYear();

  return (
    <BestOfModal
      contenders={contenders}
      storeKey={bestOfKey("month", activeTheme.id, monthKey(anchor))}
      title={t("bom.title")}
      periodLabel={`${monthLabel} ${year}`}
      championKicker={t("bom.champion")}
      emptyText={t("bom.empty")}
      emptyHint={t("bom.emptyHint")}
      fileName={shareFileName(["Best-of-Month", activeTheme.name, monthLabel, year])}
      onClose={onClose}
    />
  );
}
