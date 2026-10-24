// data.ts — Day of Music dataset.
// Covers are styled in code (typographic tiles), not bitmap reproductions of
// real album artwork. See components/day-of-music/cover.tsx for the renderer.

import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";

dayjs.extend(isoWeek);

// The typographic cover styles (rendered by components/day-of-music/cover.tsx).
// A tuple, so the share-link schema validates against this exact list.
export const COVER_STYLES = [
  "stack",
  "diag",
  "center",
  "split",
  "edge",
  "ring",
  "block",
  "ticker",
] as const;
export type CoverStyle = (typeof COVER_STYLES)[number];

export type CoverSpec = {
  style: CoverStyle;
  bg: string;
  fg: string;
  accent: string;
};

export type Album = {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  titleKo: string;
  artist: string;
  genre: string;
  year: number;
  format: string;
  cover: CoverSpec;
  /** Real artwork (e.g. from iTunes search). When set, Cover renders the
   *  bitmap instead of the typographic tile. Catalog albums omit it. */
  artworkUrl?: string;
  /** Full release date (ISO 8601, e.g. "2024-10-14T..." from iTunes). Catalog
   *  albums rely on `year` only and leave this undefined. */
  releaseDate?: string;
  /** Whether this logged item is a whole album or a single track. Defaults to
   *  "album". For a track, `title` is the track name and `artist` the artist. */
  kind?: "album" | "track";
  /** For a track: the parent album's title (shown as context). */
  albumTitle?: string;
  note: string;
  rating: number;
  tracks: string[];
  /** ISO 3166-1 alpha-2 storefront the `tracks` were fetched from. Lets the Day
   *  Detail re-localize a stale tracklist when the listener's store country
   *  differs (e.g. tracks saved as US English, now viewing as KR). */
  tracksCountry?: string;
  /** TRACKLIST_VERSION (music-types.ts) the `tracks` were fetched with. The Day
   *  Detail re-fetches a tracklist saved by an older version of the route. */
  tracksVersion?: number;
};

// Format helpers
export const MONTHS = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
] as const;

export const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

export const DOW = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;
export const DOW_KO = ["일", "월", "화", "수", "목", "금", "토"] as const;
// Column headers of the Mon-first calendars (week picker, month poster).
export const DOW_MON_FIRST = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;

const EMPTY_GENRES = new Set(["", "-", "—", "–", "ㅡ"]);

export function normalizeGenre(genre: string | undefined | null): string {
  const trimmed = genre?.trim() ?? "";
  return EMPTY_GENRES.has(trimmed) ? "" : trimmed;
}

// ── Date helpers (dayjs-backed) ─────────────────────────────────────────────
// Signatures stay Date/string based so call sites don't depend on dayjs.

export function parseDate(s: string): Date {
  return dayjs(s).toDate();
}

export function fmtDate(d: Date): string {
  return dayjs(d).format("YYYY-MM-DD");
}

// BCP-47 locale for a storefront/country region — the language most likely used
// there — so dates render in that country's own notation (KR → "2023년 4월 4일",
// US → "April 4, 2023", JP → "2023年4月4日"). Falls back to en-US.
function intlTagForCountry(country: string | undefined): string {
  if (!country) return "en-US";
  try {
    return new Intl.Locale("und", { region: country.toUpperCase() }).maximize().toString();
  } catch {
    return "en-US";
  }
}

// The Intl.Locale lookup and the DateTimeFormat constructor are the costly part
// of formatting a date, and lists format one per row (the search view, every
// album on each keystroke). A formatter depends only on (country, style), so
// each is built once.
const displayDateFormats = new Map<string, Intl.DateTimeFormat>();

function displayDateFormat(
  country: string | undefined,
  style: "long" | "short",
): Intl.DateTimeFormat {
  const key = `${country ?? ""}:${style}`;
  let format = displayDateFormats.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat(intlTagForCountry(country), {
      year: "numeric",
      month: style === "long" ? "long" : "short",
      day: "numeric",
    });
    displayDateFormats.set(key, format);
  }
  return format;
}

/** Format a single date — a Date or a "YYYY-MM-DD" / ISO string — in the
 *  listener's country notation, so every displayed date is consistent. `style`
 *  controls verbosity: "long" (default) full month name, "short" abbreviated.
 *  Returns "" for empty/invalid input. (Note: `fmtDate` stays for the canonical
 *  YYYY-MM-DD storage/lookup keys — this is display-only.) */
export function formatDisplayDate(
  input: string | Date | undefined | null,
  country: string | undefined,
  style: "long" | "short" = "long",
): string {
  if (!input) return "";
  // Date-only: drop any time/zone so the displayed day can't shift across TZs.
  const d = typeof input === "string" ? parseDate(input.slice(0, 10)) : input;
  if (!d || Number.isNaN(d.getTime())) return "";
  return displayDateFormat(country, style).format(d);
}

export function addDays(d: Date, n: number): Date {
  return dayjs(d).add(n, "day").toDate();
}

// Week starts Monday (like the reference design) — ISO week.
export function startOfWeek(d: Date): Date {
  return dayjs(d).startOf("isoWeek").toDate();
}

export function weekOfMonth(d: Date): number {
  const date = dayjs(d);
  const mondayOffset = (date.startOf("month").day() + 6) % 7;
  return Math.ceil((date.date() + mondayOffset) / 7);
}

// ── Calendar shapes ─────────────────────────────────────────────────────────
// The week strips and month grids the boards, pickers and posters lay out, in
// one place so they can't disagree about which days a period covers.

/** The seven days of the Mon–Sun week that starts on `weekStart`. */
export function weekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

/** The 1st of `anchor`'s month. */
export function monthStart(anchor: Date): Date {
  return new Date(anchor.getFullYear(), anchor.getMonth(), 1);
}

/** The last day of `anchor`'s month. */
export function monthEnd(anchor: Date): Date {
  return new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
}

/** Whether `date` (a Date or "YYYY-MM-DD") falls in `anchor`'s month. */
export function isSameMonth(date: Date | string, anchor: Date): boolean {
  const d = typeof date === "string" ? parseDate(date) : date;
  return d.getMonth() === anchor.getMonth() && d.getFullYear() === anchor.getFullYear();
}

/** The Mon-first grid showing `anchor`'s month: whole weeks from the Monday on
 *  or before the 1st through the week holding the last day — 5 or 6 rows (4
 *  for a February that starts on a Monday). */
export function monthGrid(anchor: Date): { days: Date[]; numWeeks: number } {
  const current = dayjs(anchor);
  const calStart = startOfWeek(current.startOf("month").toDate());
  // +1: diff is exclusive of the end day, so add it back to count the last day.
  const numWeeks = Math.ceil((current.endOf("month").diff(dayjs(calStart), "day") + 1) / 7);
  return { days: Array.from({ length: numWeeks * 7 }, (_, i) => addDays(calStart, i)), numWeeks };
}

/**
 * The days of a week strip that belong to its page. Normally the whole Mon–Sun
 * week; in split-by-month mode only the days in labelDate's month — e.g. a week
 * whose July part starts Wednesday keeps Wed→Sun, dropping the June Mon/Tue.
 * The board, its label and share card, and Best of Week all cut weeks this way.
 */
export function segmentDays(days: Date[], labelDate: Date, splitByMonth: boolean): Date[] {
  if (!splitByMonth) return days;
  return days.filter((d) => isSameMonth(d, labelDate));
}
