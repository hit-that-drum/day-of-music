// phone.ts — the one shared phone-viewport utility.
//
// Both queries mirror the stylesheet's breakpoints so JS and CSS never drift.
// Every window read lives inside a function: call these from event handlers
// and effects only, never during render (the server has no window, and a
// render-time read would produce a hydration mismatch).

export const PHONE_QUERY = "(max-width: 760px)";
export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/** True when the viewport currently matches the phone breakpoint (≤760px). */
export function isPhoneViewport(): boolean {
  return (
    typeof window !== "undefined" && window.matchMedia(PHONE_QUERY).matches
  );
}

/** True when the user asked the OS for reduced motion. */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia(REDUCED_MOTION_QUERY).matches
  );
}
