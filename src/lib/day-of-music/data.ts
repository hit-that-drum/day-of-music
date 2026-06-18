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

// ── Date helpers (dayjs-backed) ─────────────────────────────────────────────
// Signatures stay Date/string based so call sites don't depend on dayjs.

export function parseDate(s: string): Date {
  return dayjs(s).toDate();
}

export function fmtDate(d: Date): string {
  return dayjs(d).format("YYYY-MM-DD");
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
