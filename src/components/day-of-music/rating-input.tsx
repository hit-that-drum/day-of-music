// rating-input.tsx — the 1–5 star picker (Day Detail, Add flow). A radio group
// on the APG contract MoreSheet's language picker also follows: only the
// selected star is a Tab stop (the first while unrated), and ←/→ ↑/↓ Home/End
// move the selection. Saving is the caller's call — Day Detail commits each
// change, the add-flow holds it until the entry is logged.

"use client";

import type { KeyboardEvent } from "react";

import { useT } from "@/lib/day-of-music/i18n";

const STARS = [1, 2, 3, 4, 5] as const;

export function RatingInput({
  value,
  onChange,
  label,
  size = "md",
}: {
  /** 0 while not rated yet. */
  value: number;
  onChange: (value: number) => void;
  /** The group's accessible name, e.g. "Your rating". */
  label: string;
  /** "lg" is the add-flow's larger, padded row. */
  size?: "md" | "lg";
}) {
  const t = useT();

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const cur = value - 1; // -1 while unrated
    const last = STARS.length - 1;
    let next: number;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      next = cur < 0 ? 0 : (cur + 1) % STARS.length;
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      next = cur < 0 ? last : (cur - 1 + STARS.length) % STARS.length;
    } else if (e.key === "Home") {
      next = 0;
    } else if (e.key === "End") {
      next = last;
    } else {
      return;
    }
    e.preventDefault();
    onChange(next + 1);
    e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus();
  }

  return (
    <div
      className="dom-rate-row"
      data-size={size}
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
    >
      {STARS.map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={n === value}
          aria-label={t("aria.starsN", { n })}
          tabIndex={n === (value || 1) ? 0 : -1}
          className="dom-star"
          data-on={n <= value ? "1" : "0"}
          onClick={() => onChange(n)}
        >
          ★
        </button>
      ))}
    </div>
  );
}
