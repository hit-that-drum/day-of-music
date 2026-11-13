// theme-tabs.tsx — the active themed lane, as a carousel at the top of the
// Week and Month boards. ‹ / › (and a horizontal swipe on phones) step through
// the lanes with no ends: past the last comes the first again, and back.
// The calendar (week/month) reflects whichever theme is active here.

"use client";

import { useId, useLayoutEffect, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { useT } from "@/lib/day-of-music/i18n";
import {
  formatThemeLabel,
  resolveActiveTheme,
  useActiveTheme,
  useThemes,
} from "@/lib/day-of-music/themes";
import { slideIn, useSwipeNav } from "@/lib/day-of-music/use-swipe-nav";

type Step = 1 | -1;

export function ThemeTabs() {
  const t = useT();
  const { themes } = useThemes();
  const { activeTheme, setActiveTheme } = useActiveTheme();
  const active = resolveActiveTheme(themes, activeTheme);
  const labelId = useId();
  const barRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLSpanElement>(null);
  // Set by a step and read once by the slide below, so a lane change from
  // anywhere else (an entry opened from another lane, Profile) just shows it.
  const stepped = useRef<Step | null>(null);

  const count = themes.length;
  const index = Math.max(0, themes.findIndex((theme) => theme.id === active));
  // Both neighbours wrap around — the carousel has no first or last lane.
  const prev = themes[(index - 1 + count) % count];
  const next = themes[(index + 1) % count];

  function step(dir: Step) {
    stepped.current = dir;
    setActiveTheme((dir === 1 ? next : prev).id);
  }

  // Finger left → next lane, right → previous; phones only, as on the boards.
  useSwipeNav(barRef, { onLeft: () => step(1), onRight: () => step(-1), enabled: count > 1 });

  // The new lane's name slides in from the side the step came from.
  useLayoutEffect(() => {
    const dir = stepped.current;
    stepped.current = null;
    if (dir && nameRef.current) slideIn(nameRef.current, dir);
  }, [active]);

  if (!count) return null;
  const prevLabel = `${t("aria.prevTheme")} — ${formatThemeLabel(prev)}`;
  const nextLabel = `${t("aria.nextTheme")} — ${formatThemeLabel(next)}`;

  return (
    <div className="dom-theme-carousel" role="group" aria-labelledby={labelId}>
      <span id={labelId} className="dom-select-field-label">
        {t("tweaks.theme")}
      </span>
      <div className="dom-theme-carousel-bar" ref={barRef}>
        {/* Live, so a step is announced even though focus stays on ‹ / ›. */}
        <span className="dom-theme-carousel-name" ref={nameRef} aria-live="polite">
          {formatThemeLabel(themes[index])}
        </span>
        {count > 1 && (
          <>
            <span className="dom-theme-carousel-pos" aria-hidden="true">
              {index + 1} / {count}
            </span>
            <button
              type="button"
              className="dom-theme-carousel-btn"
              onClick={() => step(-1)}
              aria-label={prevLabel}
              title={prevLabel}
            >
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="dom-theme-carousel-btn"
              onClick={() => step(1)}
              aria-label={nextLabel}
              title={nextLabel}
            >
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
