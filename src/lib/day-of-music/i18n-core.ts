// i18n-core.ts — the pure half of i18n.ts: the five locales, how a locale is
// chosen, translate(), and the Intl date-name formatters. No directive and no
// React, so server modules and code above the profile hooks (AuthProvider) can
// use it too; the hooks bound to the current locale live in i18n.ts.

import { MESSAGES, type MessageKey } from "@/lib/day-of-music/messages";

export type Locale = "en" | "ko" | "ja" | "zh" | "es";
export type LanguagePref = "auto" | Locale;

export const DEFAULT_LOCALE: Locale = "en";

// Header switcher metadata. `label` is the short code shown to match the user's
// mental model (EN/KO/JP/CN/SP); `native` is the endonym shown in the dropdown.
export const LOCALES: { code: Locale; label: string; native: string }[] = [
  { code: "en", label: "EN", native: "English" },
  { code: "ko", label: "KO", native: "한국어" },
  { code: "ja", label: "JP", native: "日本語" },
  { code: "zh", label: "CN", native: "中文" },
  { code: "es", label: "SP", native: "Español" },
];

// Country → default locale. `country` is always an Apple Music storefront
// alpha-2 code (profile.ts's APPLE_STOREFRONTS is the single source); the two
// groups below are subsets of it. If the storefront list changes, re-check only
// these two sets.
const CN_STOREFRONTS = new Set<string>(["CN", "HK", "TW", "MO"]); // 중국 / 홍콩 / 대만 / 마카오
const SPANISH_STOREFRONTS = new Set<string>([
  "AR", "BO", "CL", "CO", "CR", "DO", "EC", "ES", "GT", "HN",
  "MX", "NI", "PA", "PE", "PY", "SV", "UY", "VE",
]);

export function localeForCountry(country: string): Locale {
  const c = country.toUpperCase();
  if (c === "KR") return "ko";
  if (c === "JP") return "ja";
  if (CN_STOREFRONTS.has(c)) return "zh";
  if (SPANISH_STOREFRONTS.has(c)) return "es";
  return "en";
}

/** The locale to render in: an explicit language wins; "auto" follows the
 *  storefront country. */
export function effectiveLocale(pref: LanguagePref, country: string): Locale {
  return pref === "auto" ? localeForCountry(country) : pref;
}

// Fill `{name}` tokens from params; leave unknown tokens untouched.
function interpolate(str: string, params: Record<string, string | number>): string {
  return str.replace(/\{(\w+)\}/g, (m, key) => (key in params ? String(params[key]) : m));
}

// Resolve one key. MessageKey and the `satisfies` check in messages.ts make
// both a missing key and a missing translation compile errors, so no fallback.
export function translate(
  locale: Locale,
  key: MessageKey,
  params?: Record<string, string | number>,
): string {
  const raw = MESSAGES[key][locale];
  return params ? interpolate(raw, params) : raw;
}

// ── Localized date names ──────────────────────────────────────────────────
// Weekday/month names follow the UI locale (chrome language), unlike release
// dates in day-detail which follow the listener's *storefront country*. Our
// Locale maps to a BCP-47 tag for Intl; `zh` renders Simplified (`zh-Hans`).
const INTL_TAG: Record<Locale, string> = {
  en: "en",
  ko: "ko",
  ja: "ja",
  zh: "zh-Hans",
  es: "es",
};

// Formatters are pure and reusable — build each (locale × option) once.
const dtfCache = new Map<string, Intl.DateTimeFormat>();
function dtf(locale: Locale, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  // Every option the helpers below pass must be part of the key, or two
  // different formats would share one cached formatter.
  const key = [
    INTL_TAG[locale],
    opts.year,
    opts.weekday,
    opts.month,
    opts.day,
    opts.hour,
    opts.minute,
  ].join("|");
  let f = dtfCache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(INTL_TAG[locale], opts);
    dtfCache.set(key, f);
  }
  return f;
}

/** Short weekday name for a date, e.g. "Mon" · "월" · "月" · "周一" · "lun.". */
export function weekdayShort(locale: Locale, date: Date): string {
  return dtf(locale, { weekday: "short" }).format(date);
}

/** Full month name for a 0-based index, e.g. "January" · "1月" · "enero". */
export function monthLong(locale: Locale, monthIndex: number): string {
  const m = ((monthIndex % 12) + 12) % 12;
  return dtf(locale, { month: "long" }).format(new Date(2020, m, 1));
}

/** Month + day, e.g. "Aug 31" · "8월 31일" · "8月31日" · "31 ago". Used where a
 *  weekday alone can't identify a day (a champion picked across a whole month). */
export function monthDayShort(locale: Locale, date: Date): string {
  return dtf(locale, { month: "short", day: "numeric" }).format(date);
}

/** Month + year in the locale's own order, e.g. "October 2026" · "2026년 10월"
 *  · "2026年10月" · "octubre de 2026". The phone pickers' headings. */
export function monthYear(locale: Locale, date: Date): string {
  return dtf(locale, { year: "numeric", month: "long" }).format(date);
}

/** Full date + time, e.g. "October 24, 2026 at 08:15 AM" · "2026년 10월 24일
 *  오전 08:15". When a share link was made, in the profile's link manager. */
export function dateTimeLong(locale: Locale, date: Date): string {
  return dtf(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/** The seven short weekday names, Monday-first. (2024-01-01 is a Monday.) */
export function weekdayRowMonFirst(locale: Locale): string[] {
  return Array.from({ length: 7 }, (_, i) => weekdayShort(locale, new Date(2024, 0, 1 + i)));
}
