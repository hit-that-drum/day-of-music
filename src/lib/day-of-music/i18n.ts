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
import { toast } from "sonner";

import { useProfile } from "@/lib/day-of-music/profile";
import type { MessageKey } from "@/lib/day-of-music/messages";
import {
  effectiveLocale,
  monthDayShort,
  monthLong,
  monthYear,
  translate,
  weekdayRowMonFirst,
  weekdayShort,
  type LanguagePref,
  type Locale,
} from "@/lib/day-of-music/i18n-core";

// The pure core, re-exported so components import language helpers from one
// place. Named, not `export *`: this is a client module.
export {
  DEFAULT_LOCALE,
  LOCALES,
  dateTimeLong,
  effectiveLocale,
  localeForCountry,
  monthDayShort,
  monthLong,
  monthYear,
  translate,
  weekdayRowMonFirst,
  weekdayShort,
  type LanguagePref,
  type Locale,
} from "@/lib/day-of-music/i18n-core";

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
  const locale = effectiveLocale(pref, country);
  return {
    locale,
    pref,
    // Every language switch (header, More sheet) goes through here, so a
    // rejected sync is reported here once, in the language still showing.
    setLanguage: (next) => {
      void save({ language: next }).then(({ error }) => {
        if (error) toast.error(translate(locale, "toast.saveFailed"), { description: error });
      });
    },
    synced,
  };
}

/** A `t(key, params?)` bound to the current effective locale. */
export function useT(): (key: MessageKey, params?: Record<string, string | number>) => string {
  const { locale } = useLanguage();
  return useMemo(
    () => (key: MessageKey, params?: Record<string, string | number>) =>
      translate(locale, key, params),
    [locale],
  );
}

/** Localized date-name helpers bound to the current effective locale. */
export function useDateNames(): {
  weekdayShort: (date: Date) => string;
  monthLong: (monthIndex: number) => string;
  monthDayShort: (date: Date) => string;
  monthYear: (date: Date) => string;
  weekdayRowMonFirst: () => string[];
} {
  const { locale } = useLanguage();
  return useMemo(
    () => ({
      weekdayShort: (date: Date) => weekdayShort(locale, date),
      monthLong: (monthIndex: number) => monthLong(locale, monthIndex),
      monthDayShort: (date: Date) => monthDayShort(locale, date),
      monthYear: (date: Date) => monthYear(locale, date),
      weekdayRowMonFirst: () => weekdayRowMonFirst(locale),
    }),
    [locale],
  );
}
