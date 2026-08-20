// poster-fit.tsx — scale-to-fit frame for the share posters, plus the
// tap-to-expand actual-size view that comes with it.
//
// The posters deliberately keep their full desktop layout at every viewport
// (7 day columns, title + artist under each cover) because that layout is what
// save-card.ts rasterizes on its fixed 1100px export stage. Letting that layout
// *reflow* into a phone's ~330px meant 44px columns: titles broke one character
// per line, the day header and its rating overlapped, and genres bled across
// the cell borders — the preview stopped resembling the PNG it was previewing.
//
// So instead of reflowing, lay the poster out at the export width and scale the
// whole thing down. The preview becomes a true miniature of the saved image,
// and the same frame fixes the public /s pages, which are opened on a phone
// more often than not. A miniature is honest but small, so tapping it moves the
// poster into a full-screen overlay at 1:1, scrollable in both axes.
//
// Only narrow viewports are scaled: above FIT_BELOW the poster still lays out
// fluidly the way it always has, so nothing changes on a desktop (and there's
// nothing to expand — it's already actual size).

"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { useT } from "@/lib/day-of-music/i18n";

/** The width posters are laid out at — matches --dom-modal-w and save-card.ts's
 *  EXPORT_WIDTH, so what's on screen is what gets saved. */
const REFERENCE_WIDTH = 1100;

/** Below this available width the fluid layout stops holding together (it's the
 *  app's own phone breakpoint), so scale instead of reflowing. */
const FIT_BELOW = 760;

type Fit = { scale: number; height: number };

export function PosterFit({ children }: { children: ReactNode }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  // null = wide enough to lay out fluidly (no scaling, no reserved height).
  const [fit, setFit] = useState<Fit | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const [stage, setStage] = useState<HTMLElement | null>(null);
  const t = useT();

  // The actual-size view is portalled to .dom-stage rather than rendered in
  // place. Both of the poster's homes sit under ancestors that are containing
  // blocks for fixed positioning — the share modal's scrim has a
  // backdrop-filter and .dom-modal animates a transform — so `position: fixed`
  // from inside would resolve against those boxes instead of the viewport.
  // .dom-stage is the outermost element that still carries every theme
  // variable the poster reads, and it has no transform or filter of its own.
  useEffect(() => {
    setStage(frameRef.current?.closest<HTMLElement>(".dom-stage") ?? null);
  }, []);

  // Rotating to a wide viewport removes the reason the overlay exists, so it
  // closes itself rather than leaving a 1:1 lightbox over a 1:1 poster.
  const expanded = zoomed && fit !== null && stage !== null;

  const measure = useCallback(() => {
    const frame = frameRef.current;
    const inner = innerRef.current;
    if (!frame || !inner) return;
    // The frame keeps its slot (and its reserved height) while the poster is
    // portalled away, so this reads the same width in both states.
    const available = frame.clientWidth;
    setFit((current) => {
      if (!available || available >= FIT_BELOW) return null;
      const scale = available / REFERENCE_WIDTH;
      // offsetHeight is the *unscaled* height (transforms don't affect it), so
      // this is the poster's natural height at the reference width.
      const height = inner.offsetHeight * scale;
      // Same numbers → same object, so a ResizeObserver callback that changes
      // nothing can't re-render (and re-measure) forever.
      if (current && current.scale === scale && current.height === height)
        return current;
      return { scale, height };
    });
  }, []);

  useEffect(() => {
    measure();
    const observer = new ResizeObserver(measure);
    if (frameRef.current) observer.observe(frameRef.current);
    // The poster's own height moves as artwork decodes and fonts settle.
    // Re-run on `expanded` too: crossing the portal remounts the inner node,
    // so the observer has to be pointed at the new one.
    if (innerRef.current) observer.observe(innerRef.current);
    return () => observer.disconnect();
  }, [measure, expanded]);

  useEffect(() => {
    if (!expanded) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      // Capture phase + stopPropagation so Escape dismisses the zoom view
      // first; the share Modal's own Escape handler listens on window in the
      // bubble phase and would otherwise close the whole modal underneath.
      e.stopPropagation();
      setZoomed(false);
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [expanded]);

  const poster = (
    <div
      className="dom-poster-fit-inner"
      ref={innerRef}
      style={
        fit
          ? {
              width: REFERENCE_WIDTH,
              transform: expanded ? undefined : `scale(${fit.scale})`,
            }
          : undefined
      }
    >
      {children}
    </div>
  );

  return (
    <div
      className="dom-poster-fit"
      ref={frameRef}
      // The scaled poster is out of flow as far as layout is concerned, so the
      // frame has to carry its visual height for the actions row to sit below —
      // and hold the slot open while the poster is away in the overlay.
      style={fit ? { height: fit.height } : undefined}
    >
      {!expanded && poster}

      {fit && !expanded && (
        <button
          type="button"
          className="dom-poster-zoom"
          onClick={() => setZoomed(true)}
          aria-label={t("poster.zoomOpen")}
        >
          <span className="dom-poster-zoom-hint">{t("poster.zoom")} ↗</span>
        </button>
      )}

      {expanded &&
        createPortal(
          <div
            className="dom-poster-zoom-view"
            role="dialog"
            aria-modal="true"
            aria-label={t("poster.zoomLabel")}
            // Tapping the margin around the 1:1 poster closes, like a lightbox.
            onClick={(e) => {
              if (e.target === e.currentTarget) setZoomed(false);
            }}
          >
            {poster}
            <button
              type="button"
              className="dom-poster-zoom-close"
              onClick={() => setZoomed(false)}
              aria-label={t("poster.zoomClose")}
            >
              ✕
            </button>
          </div>,
          stage,
        )}
    </div>
  );
}
