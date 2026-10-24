// best-of-button.tsx — the Best of Week / Best of Month entry button on the
// boards. Each board works out its own status and hint (the week and month
// ladders differ); this renders them identically.

"use client";

import { toast } from "sonner";

import { Button } from "@/components/day-of-music/atoms";
import type { BestOfMonthStatus, BestOfStatus } from "@/lib/day-of-music/best-of";

export function BestOfButton({
  status,
  hint,
  blocked,
  label,
  onOpen,
}: {
  /** Drives the colour (.dom-btn[data-bestof] in the stylesheet). */
  status: BestOfStatus | BestOfMonthStatus;
  /** Spelled-out reason behind the colour: tooltip, toast and aria. */
  hint: string | undefined;
  /** Not playable yet — a click explains why instead of opening. */
  blocked: boolean;
  label: string;
  onOpen: () => void;
}) {
  return (
    <Button
      variant="ghost"
      onClick={blocked ? () => toast(hint) : onOpen}
      data-bestof={status}
      title={hint}
      aria-disabled={blocked || undefined}
      aria-label={hint && `${label} — ${hint}`}
    >
      {status === "done" && (
        <span className="dom-bestof-trophy" aria-hidden="true">
          🏆
        </span>
      )}
      {label}
    </Button>
  );
}
