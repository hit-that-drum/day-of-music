// use-swipe-nav.ts — phone-only navigation helpers for the Week and Month
// boards: a horizontal-swipe recognizer (useSwipeNav) and the slide-in that
// plays when the board's page changes (useNavSlide). Both render nothing.
//
// useSwipeNav — Pointer Events only: React registers touchstart/touchmove as
// passive on the root, so a touchmove preventDefault would be a no-op, and we
// need pointerType anyway (mouse drags stay free for native HTML5 DnD). It
// attaches native listeners to the board root in an effect and reads
// matchMedia inside the pointerdown handler — never during render — so the
// server and first client render are identical. Scroll-vs-swipe is decided by
// CSS, not here: `touch-action: pan-y pinch-zoom` on .dom-week/.dom-month at
// ≤760px (day-of-music.css, Phone pass) lets a vertical pan scroll natively;
// the browser then fires pointercancel, which simply resets the gesture.
//
// Never preventDefault a pointer event and never setPointerCapture: the first
// cancels the compat mouse events (kills tap-to-open on the day cells), the
// second re-targets the click to the board. Touch pointers already have
// implicit capture on their pointerdown target, so pointermove/pointerup bubble
// up to the board even after the finger leaves the cell.
//
// useNavSlide — Web Animations API in a layout effect instead of key= +
// @keyframes: keying the container would remount every cell on desktop too
// (the month grid's cells are key={i}, so a keyboard user would lose focus on
// every ←/→), and effects are client-only, so there is no hydration surface.
// Desktop and prefers-reduced-motion get no animation and no DOM change.

"use client";

import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  type RefObject,
} from "react";

import { PHONE_QUERY, REDUCED_MOTION_QUERY } from "@/lib/day-of-music/phone";

export type SwipeNavOptions = {
  /** Finger moved left (dx < 0) — callers pass their onNext. */
  onLeft: () => void;
  /** Finger moved right (dx > 0) — callers pass their onPrev. */
  onRight: () => void;
  /** Default true. False detaches every listener. */
  enabled?: boolean;
};

// Recognizer constants (CSS px / ms), tuned for a 323px-wide board on a 375px
// phone: 56px is ~17% of the board and a third of a 161px week cell, so a
// wobble while tapping can't commit.
const SLOP = 10; // movement before the axis is decided
const THRESHOLD = 56; // |dx| for a normal swipe (with ratio + duration below)
const AXIS_RATIO = 1.5; // |dx| ≥ 1.5·|dy| at release
const MAX_DURATION = 800; // ms — slower than this is a drag, not a swipe
const FLICK_DISTANCE = 32; // a quick flick commits from here…
const FLICK_VELOCITY = 0.5; // …when it moved at ≥ 0.5 px/ms
const FAR_DISTANCE = 120; // this far always commits, however slow
const EDGE_GUARD = 20; // iOS back/forward system swipe starts at the edge
const CLICK_SUPPRESS_MS = 350; // swallow the click a committed swipe leaves
// Pointerdowns inside these never start a gesture. The WeekPicker renders
// inside .dom-week (its fixed backdrop is a descendant); the other two are
// defensive, for any dropdown/dialog that may later land inside a board.
const IGNORE_WITHIN = '[role="dialog"], .dom-wp-backdrop, .dom-select-panel';

type Gesture = {
  id: number | null;
  x0: number;
  y0: number;
  t0: number;
  lock: "none" | "h" | "cancelled";
  suppressClickUntil: number;
};

export function useSwipeNav<T extends HTMLElement>(
  ref: RefObject<T | null>,
  { onLeft, onRight, enabled = true }: SwipeNavOptions,
): void {
  // Plain mutable record — no React state is written during a gesture, so
  // nothing re-renders mid-swipe and the implicit-capture target stays mounted.
  const gesture = useRef<Gesture>({
    id: null,
    x0: 0,
    y0: 0,
    t0: 0,
    lock: "none",
    suppressClickUntil: 0,
  });

  // Effect Event: always sees the latest callbacks without re-attaching the
  // listeners when the parent re-renders (and without going in the deps).
  const commit = useEffectEvent((dx: number) => {
    if (dx < 0) onLeft();
    else onRight();
  });

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    const g = gesture.current;

    const reset = () => {
      g.id = null;
      g.lock = "none";
    };

    function onPointerDown(e: PointerEvent) {
      // Every new pointerdown supersedes whatever was pending. A second finger
      // (pinch) aborts the gesture, and a pen lifted outside the board never
      // delivers its pointerup here (no implicit capture), so without this a
      // filtered-out pointerdown below could leave the stale x0/t0 in place
      // for the next stroke to commit against.
      reset();
      if (!e.isPrimary) return;
      if (e.pointerType === "mouse" || e.button !== 0) return;
      if (!window.matchMedia(PHONE_QUERY).matches) return;
      const target = e.target as Element | null;
      if (target?.closest(IGNORE_WITHIN)) return;
      // Layout viewport, not innerWidth: while pinch-zoomed, iOS shrinks
      // innerWidth to the visual viewport but clientX stays layout-relative,
      // so innerWidth would blank the right half of the board at 2×.
      const vw = document.documentElement.clientWidth;
      if (e.clientX < EDGE_GUARD || e.clientX > vw - EDGE_GUARD) return;
      g.id = e.pointerId;
      g.x0 = e.clientX;
      g.y0 = e.clientY;
      g.t0 = e.timeStamp;
      g.lock = "none";
    }

    function onPointerMove(e: PointerEvent) {
      if (e.pointerId !== g.id || g.lock !== "none") return;
      const dx = e.clientX - g.x0;
      const dy = e.clientY - g.y0;
      if (Math.hypot(dx, dy) < SLOP) return;
      g.lock = Math.abs(dx) > Math.abs(dy) ? "h" : "cancelled";
    }

    function onPointerUp(e: PointerEvent) {
      if (e.pointerId !== g.id) return;
      if (g.lock === "h") {
        const dx = e.clientX - g.x0;
        const dy = e.clientY - g.y0;
        const dt = Math.max(1, e.timeStamp - g.t0);
        const ax = Math.abs(dx);
        const ok =
          ax >= FAR_DISTANCE ||
          (ax >= THRESHOLD &&
            ax >= AXIS_RATIO * Math.abs(dy) &&
            dt <= MAX_DURATION) ||
          (ax >= FLICK_DISTANCE && ax / dt >= FLICK_VELOCITY);
        if (ok) {
          g.suppressClickUntil = performance.now() + CLICK_SUPPRESS_MS;
          commit(dx);
        }
      }
      reset();
    }

    // The browser took the pointer: vertical pan (scroll), iOS native drag
    // start, iOS edge gesture, incoming call… — never commit.
    function onPointerCancel() {
      reset();
    }
    // A native HTML5 drag began on a draggable cell (iOS long-press): not a
    // swipe, even if a pointerup were still to arrive. Also run on dragend so
    // the recognizer is guaranteed clean once the native drag finishes.
    function onDragStart() {
      reset();
    }
    // A committed swipe inside one 161px cell leaves pointerdown and pointerup
    // on the same button, so an engine may still dispatch click — the album
    // would open under the week that just slid in. Native capture at the board
    // runs before React's root listener, so stopping here means the cell's
    // onClick never fires. Time-boxed and scoped to the board on purpose.
    function onClickCapture(e: MouseEvent) {
      if (performance.now() < g.suppressClickUntil) {
        e.stopPropagation();
        e.preventDefault();
      }
    }

    const passive = { passive: true } as const;
    el.addEventListener("pointerdown", onPointerDown, passive);
    el.addEventListener("pointermove", onPointerMove, passive);
    el.addEventListener("pointerup", onPointerUp, passive);
    el.addEventListener("pointercancel", onPointerCancel, passive);
    el.addEventListener("dragstart", onDragStart, true);
    el.addEventListener("dragend", onDragStart, true);
    el.addEventListener("click", onClickCapture, true);
    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerCancel);
      el.removeEventListener("dragstart", onDragStart, true);
      el.removeEventListener("dragend", onDragStart, true);
      el.removeEventListener("click", onClickCapture, true);
      reset();
    };
  }, [ref, enabled]);
}

// Slide-in on navigation. 12px stays inside the boards' 14px phone gutter so
// .dom-main's overflow:hidden never clips it; 200ms like the hover lifts, same
// vocabulary as dom-rise (translate + fade). Plays for every way of getting to
// a new page — swipe, ←/→ buttons, keyboard, week picker — because it keys on
// the page, not on the gesture.
const SLIDE_DISTANCE = 12; // px
const SLIDE_DURATION = 200; // ms

/**
 * Animate `ref` sliding in from the side it came from whenever `navKey`
 * changes. `navKey` must compare lexically in time order (YYYY-MM-DD or
 * YYYY-MM): greater = later = "next" = enters from the right (+12px).
 * No-op on first mount, on desktop (≥761px) and under reduced motion.
 */
export function useNavSlide<T extends HTMLElement>(
  ref: RefObject<T | null>,
  navKey: string,
): void {
  const prevKey = useRef(navKey);

  // Layout effect: runs after React commits the new cells but before paint, so
  // the first painted frame is already at translateX(±12px)/opacity 0.
  useLayoutEffect(() => {
    if (prevKey.current === navKey) return;
    const dir = navKey > prevKey.current ? 1 : -1;
    prevKey.current = navKey;
    const el = ref.current;
    if (!el || typeof el.animate !== "function") return;
    if (!window.matchMedia(PHONE_QUERY).matches) return;
    if (window.matchMedia(REDUCED_MOTION_QUERY).matches) return;
    // A second navigation inside the 200ms replaces the in-flight slide.
    for (const a of el.getAnimations()) a.cancel();
    el.animate(
      [
        { transform: `translateX(${SLIDE_DISTANCE * dir}px)`, opacity: 0 },
        { transform: "none", opacity: 1 },
      ],
      { duration: SLIDE_DURATION, easing: "ease" },
    );
  }, [ref, navKey]);
}
