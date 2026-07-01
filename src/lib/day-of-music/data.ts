// data.ts — Day of Music dataset.
// Covers are styled in code (typographic tiles), not bitmap reproductions of
// real album artwork. See components/day-of-music/cover.tsx for the renderer.

import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";

dayjs.extend(isoWeek);

export type CoverStyle =
  | "stack"
  | "diag"
  | "center"
  | "split"
  | "edge"
  | "ring"
  | "block"
  | "ticker";

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
};

// User-added albums (from iTunes search) are the only source of albums now;
// the seed catalog was intentionally emptied.
export const ALBUMS: Album[] = [];

// Lookup by date for fast access.
export const ALBUMS_BY_DATE: Record<string, Album> = Object.fromEntries(
  ALBUMS.map((a) => [a.date, a]),
);

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

// Genres covered (used by search)
export const GENRES = [
  "Pop", "Hip-Hop", "Electronic", "Jazz", "Indie Folk", "R&B",
  "Alt Rock", "Folk", "Latin · Reggaeton", "R&B · Dance",
] as const;

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
function localeForCountry(country: string | undefined): string {
  if (!country) return "en-US";
  try {
    return new Intl.Locale("und", { region: country.toUpperCase() }).maximize().toString();
  } catch {
    return "en-US";
  }
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
  return new Intl.DateTimeFormat(localeForCountry(country), {
    year: "numeric",
    month: style === "long" ? "long" : "short",
    day: "numeric",
  }).format(d);
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
