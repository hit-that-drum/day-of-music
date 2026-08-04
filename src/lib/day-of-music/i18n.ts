// i18n.ts — language model for Day of Music (EN · KO · JP · CN · SP).
//
// The effective locale is derived, not stored directly. A user's *preference*
// is either "auto" (follow the Profile storefront country) or an explicit
// Locale. Picking a language in the header writes an explicit Locale, so it
// wins over the country default from then on — while "auto" keeps re-deriving
// from the country. This mirrors the country/tweaks stores: the preference is
// persisted in profile.ts (localStorage for guests, user_metadata when signed
// in) and read through useProfile().

"use client";

import { useMemo } from "react";

import { useProfile } from "@/lib/day-of-music/profile";
import { MESSAGES } from "@/lib/day-of-music/messages";

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

// Fill `{name}` tokens from params; leave unknown tokens untouched.
function interpolate(str: string, params: Record<string, string | number>): string {
  return str.replace(/\{(\w+)\}/g, (m, key) => (key in params ? String(params[key]) : m));
}

// Resolve one key. Falls back current locale → English → the key itself, so a
// key that isn't translated (or not defined yet) degrades gracefully.
export function translate(
  locale: Locale,
  key: string,
  params?: Record<string, string | number>,
): string {
  const entry = MESSAGES[key];
  const raw = entry ? (entry[locale] ?? entry.en) : key;
  return params ? interpolate(raw, params) : raw;
}

/**
 * Language preference + the resolved effective locale.
 * - `locale`: the effective locale to render in (derived from pref/country).
 * - `pref`: the stored preference ("auto" or an explicit Locale).
 * - `setLanguage`: persist a new preference (explicit choice overrides country).
 */
export function useLanguage(): {
  locale: Locale;
  pref: LanguagePref;
  setLanguage: (pref: LanguagePref) => void;
  synced: boolean;
} {
  const { country, language, save, synced } = useProfile();
  const pref = language;
  const locale = pref === "auto" ? localeForCountry(country) : pref;
  return {
    locale,
    pref,
    setLanguage: (next) => save({ language: next }),
    synced,
  };
}

/** A `t(key, params?)` bound to the current effective locale. */
export function useT(): (key: string, params?: Record<string, string | number>) => string {
  const { locale } = useLanguage();
  return useMemo(
    () => (key: string, params?: Record<string, string | number>) => translate(locale, key, params),
    [locale],
  );
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
  const key = `${INTL_TAG[locale]}|${opts.weekday ?? ""}|${opts.month ?? ""}`;
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

/** The seven short weekday names, Monday-first. (2024-01-01 is a Monday.) */
export function weekdayRowMonFirst(locale: Locale): string[] {
  return Array.from({ length: 7 }, (_, i) => weekdayShort(locale, new Date(2024, 0, 1 + i)));
}

/** Localized date-name helpers bound to the current effective locale. */
export function useDateNames(): {
  weekdayShort: (date: Date) => string;
  monthLong: (monthIndex: number) => string;
  weekdayRowMonFirst: () => string[];
} {
  const { locale } = useLanguage();
  return useMemo(
    () => ({
      weekdayShort: (date: Date) => weekdayShort(locale, date),
      monthLong: (monthIndex: number) => monthLong(locale, monthIndex),
      weekdayRowMonFirst: () => weekdayRowMonFirst(locale),
    }),
    [locale],
  );
}
