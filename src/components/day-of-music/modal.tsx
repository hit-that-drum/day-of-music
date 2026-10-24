// modal.tsx — shared modal chrome: scrim, panel wrapper, and the close button.
// Every overlay modal renders through this so the dialog semantics, dismiss
// behaviour (scrim click / ✕ / Esc), and close-button position stay identical.
// The ✕ floats in a reserved gap above the panel, flush to its right edge, so
// it never overlaps panel content (see .dom-modal in day-of-music.css).
//
// On phones (≤760px — the "Bottom sheets" section near the end of
// day-of-music.css) the same markup is a bottom sheet: .dom-modal-bar is a
// sticky header band with a drag handle, and dragging it down dismisses.
// Nothing here branches on the viewport: the band is always rendered and CSS
// decides whether it has a box (display:contents on desktop), so server and
// client markup match.

"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

import { useEscapeLayer } from "@/lib/day-of-music/escape-layers";
import { useT } from "@/lib/day-of-music/i18n";
import { PHONE_QUERY, REDUCED_MOTION_QUERY } from "@/lib/day-of-music/phone";

/** Drag the handle past this (px) and let go → the sheet dismisses… */
const DISMISS_DISTANCE = 96;
/** …or flick it: faster than this (px/ms) over at least FLICK_MIN px. */
const DISMISS_VELOCITY = 0.5;
const FLICK_MIN = 24;
/** Velocity is read over the last VELOCITY_WINDOW ms of movement only (so a
 *  press-and-hold before the flick can't average it away), and never over a
 *  window shorter than VELOCITY_FLOOR ms (so one jittery sample can't fake
 *  a flick). */
const VELOCITY_WINDOW = 120;
const VELOCITY_FLOOR = 50;

/** Callback ref replacing `autoFocus` inside modals: focuses on mount except on
 *  phones, where the sheet is still sliding up and the keyboard would cover its
 *  footer (iOS doesn't shrink dvh for the keyboard). On phones focus still has
 *  to ENTER the dialog (keyboard/AT users would otherwise be left on the opener
 *  behind the scrim), so it lands on the sheet itself (tabIndex -1, no field →
 *  no keyboard; preventScroll keeps the slide-up intact). Module-level so the
 *  ref identity is stable. Runs only on the client (refs attach during commit). */
export function focusUnlessPhone(el: HTMLElement | null) {
  if (!el) return;
  if (!window.matchMedia(PHONE_QUERY).matches) {
    el.focus();
    return;
  }
  el.closest<HTMLElement>(".dom-modal")?.focus({ preventScroll: true });
}

// What Tab can land on inside a panel (visibility is checked separately).
const TABBABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

type Sample = { y: number; t: number };
type Drag = { id: number; startY: number; dy: number; samples: Sample[] };

// The dialog's accessible name: its visible title when it has one (so the two
// can't drift apart), otherwise a label of its own.
type ModalName =
  | { /** Accessible dialog name (aria-label). */ label: string; labelledBy?: undefined }
  | { /** id of the visible title (aria-labelledby). */ labelledBy: string; label?: undefined };

export function Modal({
  label,
  labelledBy,
  onClose,
  className,
  width,
  children,
}: ModalName & {
  onClose: () => void;
  /** Extra class(es) on the panel wrapper, for modal-specific layout. */
  className?: string;
  /** Max width in px when narrower than the shared default (--dom-modal-w on
   *  .dom-scrim) — so the ✕, which floats over the panel's right edge, lines
   *  up with a small dialog too. */
  width?: number;
  children: ReactNode;
}) {
  const t = useT();
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);
  // Cleanup of the spring-back still pending from the last settle(), so a new
  // drag or settle can cancel it (a stale one would reset the transition).
  const settleRef = useRef<(() => void) | null>(null);

  // Escape closes this modal unless something opened over it is still open.
  useEscapeLayer(onClose);

  // Focus enters the dialog when it opens and goes back to its opener when it
  // closes; otherwise keyboard and screen-reader users stay on — or return to
  // — whatever sits behind the scrim. The opener is read as the dialog first
  // renders, before a field's focusUnlessPhone ref can move focus inside.
  const [opener] = useState(() =>
    typeof document === "undefined" ? null : (document.activeElement as HTMLElement | null),
  );
  useEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    // A field may already have it (focusUnlessPhone); otherwise the panel.
    if (!sheet.contains(document.activeElement)) sheet.focus({ preventScroll: true });
    return () => {
      // Only when focus went down with this dialog: never take it from a
      // dialog that opened in the same commit (Day Detail → Replace → Add).
      const lost = !document.activeElement || document.activeElement === document.body;
      if (opener?.isConnected && (lost || sheet.contains(document.activeElement))) {
        opener.focus();
      }
    };
  }, [opener]);

  // Tab stays in the dialog: past the last control it wraps to the first, and
  // Shift+Tab the other way. aria-modal hides the board behind the scrim from
  // screen readers, but not from the keyboard.
  function onPanelKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    const sheet = sheetRef.current;
    if (e.key !== "Tab" || !sheet) return;
    // A dialog opened inside this one (the public-link confirm) keeps its own.
    if ((e.target as Element).closest(".dom-modal") !== sheet) return;
    const tabbables = Array.from(sheet.querySelectorAll<HTMLElement>(TABBABLE)).filter(
      (el) => el.getClientRects().length > 0,
    );
    const first = tabbables[0];
    const last = tabbables[tabbables.length - 1];
    if (!first || !last) {
      e.preventDefault();
      return;
    }
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === sheet)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  // Return the sheet to rest. Clearing the inline transform matters: a
  // transformed .dom-modal is the containing block for fixed descendants
  // (the nested public-link confirm's scrim), so it must never stay on.
  function settle(sheet: HTMLDivElement) {
    settleRef.current?.();
    if (window.matchMedia(REDUCED_MOTION_QUERY).matches) {
      sheet.style.transition = "";
      sheet.style.transform = "";
      return;
    }
    sheet.style.transition = "transform 0.2s ease";
    sheet.style.transform = "";
    // transitionend bubbles: a child's own transition (.dom-btn colours)
    // ending mid-spring-back must not cut ours short, so only the sheet's
    // transform counts. The timer is the fallback for when no transitionend
    // ever comes (hidden tab, display:none) — this is the inline transition's
    // only cleanup path.
    const done = (ev?: Event) => {
      if (ev && (ev.target !== sheet || (ev as TransitionEvent).propertyName !== "transform")) {
        return;
      }
      window.clearTimeout(timer);
      sheet.removeEventListener("transitionend", done);
      settleRef.current = null;
      sheet.style.transition = "";
    };
    const timer = window.setTimeout(done, 250);
    sheet.addEventListener("transitionend", done);
    settleRef.current = done;
  }

  function onBarPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    // One pointer at a time — a second finger must not hijack the drag.
    if (dragRef.current) return;
    // Only a press on the band itself or the handle starts a drag. On desktop
    // the band is display:contents (no box of its own), so the only events
    // that reach this handler bubble up from the ✕ — those must stay clicks
    // (pointer capture would redirect the click away from the button).
    const target = e.target as Element;
    if (target !== e.currentTarget && !target.classList.contains("dom-modal-handle")) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const sheet = sheetRef.current;
    if (!sheet) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      return; // pointer already inactive (InvalidPointerId)
    }
    // A spring-back still in flight is cut short by the new drag.
    settleRef.current?.();
    // The entry keyframe (dom-sheet-up) wins over an inline transform for its
    // first 250ms; switching it off lands the sheet at rest so the drag shows
    // at once. It stays off for the life of the sheet — clearing it later
    // would replay the slide-in from the bottom.
    sheet.style.animation = "none";
    sheet.style.transition = "none";
    dragRef.current = {
      id: e.pointerId,
      startY: e.clientY,
      dy: 0,
      samples: [{ y: e.clientY, t: performance.now() }],
    };
  }

  function onBarPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const d = dragRef.current;
    const sheet = sheetRef.current;
    if (!d || d.id !== e.pointerId || !sheet) return;
    const now = performance.now();
    d.dy = Math.max(0, e.clientY - d.startY);
    d.samples.push({ y: e.clientY, t: now });
    while (d.samples.length > 1 && now - d.samples[0].t > VELOCITY_WINDOW) {
      d.samples.shift();
    }
    // Direct DOM write — no setState per move.
    sheet.style.transform = d.dy > 0 ? `translateY(${d.dy}px)` : "";
  }

  function finishDrag(e: ReactPointerEvent<HTMLDivElement>, cancelled: boolean) {
    const d = dragRef.current;
    if (!d || d.id !== e.pointerId) return;
    dragRef.current = null;
    const sheet = sheetRef.current;
    if (!sheet) return;
    if (d.dy === 0) {
      sheet.style.transition = "";
      return;
    }
    const oldest = d.samples[0];
    const velocity =
      (e.clientY - oldest.y) / Math.max(VELOCITY_FLOOR, performance.now() - oldest.t);
    const flick = d.dy >= FLICK_MIN && velocity > DISMISS_VELOCITY;
    settle(sheet);
    // Same onClose as ✕ / scrim / Esc, so consumers' busy-guards still apply;
    // if a guard refuses, the sheet has already sprung back.
    if (!cancelled && (d.dy > DISMISS_DISTANCE || flick)) onClose();
  }

  return (
    <div className="dom-scrim" onClick={onClose} role="presentation">
      <div
        ref={sheetRef}
        className={className ? `dom-modal ${className}` : "dom-modal"}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        aria-labelledby={labelledBy}
        style={width ? ({ "--dom-modal-w": `${width}px` } as CSSProperties) : undefined}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onPanelKeyDown}
      >
        <div
          className="dom-modal-bar"
          onPointerDown={onBarPointerDown}
          onPointerMove={onBarPointerMove}
          onPointerUp={(e) => finishDrag(e, false)}
          onPointerCancel={(e) => finishDrag(e, true)}
          onLostPointerCapture={(e) => finishDrag(e, true)}
        >
          <span className="dom-modal-handle" aria-hidden="true" />
          <button
            type="button"
            className="dom-modal-close"
            onClick={onClose}
            aria-label={t("modal.close")}
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
