// today.ts — "today" as the listener sees it, shared by the server page and
// the client board. The server has no clock in the listener's zone, so the
// client leaves its IANA zone in a cookie and the server formats its own
// clock in that zone. Plain helpers, no React, so app/week/page.tsx (a server
// component) can import this too.

/** Cookie carrying the browser's IANA time zone (e.g. "Asia/Seoul"). Not a
 *  secret and no more identifying than the request itself, so it is a plain
 *  cookie the client writes with document.cookie (no HttpOnly / Secure). */
export const TZ_COOKIE = "dom.tz";

// formatToParts rather than a locale's date pattern, so the output never
// depends on how "en-US" happens to order year/month/day.
function dateParts(timeZone: string | undefined, now: Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
}

/** Today's YYYY-MM-DD in `timeZone` (IANA), or in the process's own zone when
 *  the zone is missing or not one Intl knows (an old or garbled cookie). */
export function todayInZone(
  timeZone: string | undefined,
  now: Date = new Date(),
): string {
  let parts: Intl.DateTimeFormatPart[];
  try {
    // No decoding here: next/headers' cookies() already percent-decodes every
    // value (and drops a malformed one), so this only ever sees a plain name.
    // An empty string must become undefined: Intl rejects "" like any unknown
    // zone.
    parts = dateParts(timeZone || undefined, now);
  } catch {
    // RangeError (unknown zone). A bad cookie must never break the render, so
    // fall back to the server's own zone — the client corrects the day after
    // mount.
    parts = dateParts(undefined, now);
  }
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Client only: remember the browser's zone for the next server render (see
 *  TZ_COOKIE). Max-Age a year (Safari caps script-set cookies at 7 days);
 *  refreshed on every visit, so at worst one correction after a long absence.
 *  SameSite=Lax so it rides along on top-level navigations only. */
export function rememberTimeZone(): void {
  if (typeof document === "undefined") return;
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!tz) return;
    // IANA names only use letters, digits, "/", "_", "+", "-" — all legal in a
    // cookie value, so no encoding on either side.
    document.cookie = `${TZ_COOKIE}=${tz}; Path=/; Max-Age=31536000; SameSite=Lax`;
  } catch {
    /* Intl unavailable or cookies refused — the server keeps its own zone */
  }
}
