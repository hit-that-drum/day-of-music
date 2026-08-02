// profile.ts — user profile prefs (display name + storefront country).
// Signed-in users store these on their Supabase account (user_metadata) so they
// sync across devices; guests / local mode fall back to localStorage. Use
// `useProfile()` for the resolved values + a single save().

"use client";

import { useSyncExternalStore } from "react";
import isoCountries from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";
import koLocale from "i18n-iso-countries/langs/ko.json";

import { useAuth } from "@/components/day-of-music/auth-provider";
import { makeStringStore } from "@/lib/day-of-music/local-store";
import type { LanguagePref } from "@/lib/day-of-music/i18n";

isoCountries.registerLocale(enLocale);
isoCountries.registerLocale(koLocale);

export const DEFAULT_USERNAME = "listener";
export const DEFAULT_COUNTRY = "US";
// "auto" follows the storefront country (see localeForCountry in i18n.ts); an
// explicit language chosen in the header replaces it.
export const DEFAULT_LANGUAGE: LanguagePref = "auto";

// Apple Media Services (Apple Music) storefronts — ISO 3166-1 alpha-2. Country
// libraries list every ISO country, but only these have an Apple Music store,
// so we filter the picker to them. Update from Apple's storefront list if it
// changes.
const APPLE_STOREFRONTS = new Set<string>([
  "AE", "AG", "AI", "AL", "AM", "AO", "AR", "AT", "AU", "AZ", "BB", "BE", "BF",
  "BG", "BH", "BJ", "BM", "BN", "BO", "BR", "BS", "BT", "BW", "BY", "BZ", "CA",
  "CG", "CH", "CL", "CN", "CO", "CR", "CV", "CY", "CZ", "DE", "DK", "DM", "DO",
  "DZ", "EC", "EE", "EG", "ES", "FI", "FJ", "FM", "FR", "GB", "GD", "GH", "GM",
  "GR", "GT", "GW", "GY", "HK", "HN", "HR", "HU", "ID", "IE", "IL", "IN", "IQ",
  "IS", "IT", "JM", "JO", "JP", "KE", "KG", "KH", "KN", "KR", "KW", "KY", "KZ",
  "LA", "LB", "LC", "LK", "LR", "LT", "LU", "LV", "MD", "MG", "MK", "ML", "MN",
  "MO", "MR", "MS", "MT", "MU", "MW", "MX", "MY", "MZ", "NA", "NE", "NG", "NI",
  "NL", "NO", "NP", "NZ", "OM", "PA", "PE", "PG", "PH", "PK", "PL", "PT", "PW",
  "PY", "QA", "RO", "RS", "SA", "SB", "SC", "SE", "SG", "SI", "SK", "SL", "SN",
  "SR", "ST", "SV", "SZ", "TC", "TD", "TH", "TJ", "TM", "TN", "TR", "TT", "TW",
  "TZ", "UA", "UG", "US", "UY", "UZ", "VC", "VE", "VG", "VN", "YE", "ZA", "ZM",
  "ZW",
]);

// Best-guess storefront from the browser locale, so a listener's *own* store
// (and its language) is searched first by default — e.g. a Korean browser gets
// the KR store ("방탄소년단", "이적") instead of the US one ("BTS", "Lee Juck").
// Client-only (reads navigator); falls back to DEFAULT_COUNTRY when the region
// can't be resolved or has no Apple Music store. Only used when the listener
// hasn't explicitly chosen a country — an explicit choice always wins.
export function detectStorefront(): string {
  if (typeof navigator === "undefined") return DEFAULT_COUNTRY;
  try {
    const locales = navigator.languages?.length
      ? navigator.languages
      : [navigator.language];
    for (const loc of locales) {
      if (!loc) continue;
      // "ko" → KR, "ko-KR" → KR, "en-GB" → GB (maximize fills in the likely region).
      const region = new Intl.Locale(loc).maximize().region;
      if (region && APPLE_STOREFRONTS.has(region)) return region;
    }
  } catch {
    /* Intl.Locale unsupported or malformed tag — fall through */
  }
  return DEFAULT_COUNTRY;
}

// alpha-2 → flag emoji (regional-indicator letters). Renders as plain text, so
// it works inside a native <select><option> (unlike SVG flag components).
function flagEmoji(code: string): string {
  return code
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65));
}

export type Country = { code: string; label: string };

// Built once: Apple storefronts that resolve to a name, with flag + EN/KO
// labels, sorted by English name.
export const COUNTRIES: Country[] = Array.from(APPLE_STOREFRONTS)
  .map((code) => {
    const en = isoCountries.getName(code, "en");
    if (!en) return null;
    const ko = isoCountries.getName(code, "ko");
    return {
      code,
      en,
      label: `${flagEmoji(code)}  ${en}${ko && ko !== en ? ` · ${ko}` : ""}`,
    };
  })
  .filter((c): c is { code: string; en: string; label: string } => c !== null)
  .sort((a, b) => a.en.localeCompare(b.en))
  .map(({ code, label }) => ({ code, label }));

export type ProfilePatch = {
  username?: string;
  country?: string;
  language?: LanguagePref;
};

// localStorage-backed stores (one per key) live in local-store.ts — read via
// useSyncExternalStore so they survive reloads without a hydration mismatch.
const usernameStore = makeStringStore("dom.username.v1", DEFAULT_USERNAME);
const countryStore = makeStringStore("dom.country.v1", DEFAULT_COUNTRY, detectStorefront);
const languageStore = makeStringStore("dom.language.v1", DEFAULT_LANGUAGE);

/**
 * Resolved profile (display name + storefront country) and a single `save`.
 * Signed-in users read/write user_metadata (synced); guests and local mode use
 * per-device localStorage.
 */
export function useProfile(): {
  username: string;
  country: string;
  language: LanguagePref;
  save: (patch: ProfilePatch) => void;
  synced: boolean;
} {
  const { configured, user, updateUserMetadata } = useAuth();
  const localUsername = useSyncExternalStore(
    usernameStore.subscribe,
    usernameStore.getSnapshot,
    usernameStore.getServerSnapshot,
  );
  const localCountry = useSyncExternalStore(
    countryStore.subscribe,
    countryStore.getSnapshot,
    countryStore.getServerSnapshot,
  );
  const localLanguage = useSyncExternalStore(
    languageStore.subscribe,
    languageStore.getSnapshot,
    languageStore.getServerSnapshot,
  );

  if (configured && user) {
    const meta = user.user_metadata ?? {};
    return {
      username: (meta.username as string | undefined) ?? "",
      // No saved country yet → fall back to the locale's storefront, not US.
      country: (meta.country as string | undefined) ?? detectStorefront(),
      language: (meta.language as LanguagePref | undefined) ?? DEFAULT_LANGUAGE,
      save: (patch) => void updateUserMetadata(patch),
      synced: true,
    };
  }
  return {
    username: localUsername,
    country: localCountry,
    language: localLanguage as LanguagePref,
    save: (patch) => {
      if (patch.username !== undefined) usernameStore.set(patch.username);
      if (patch.country !== undefined) countryStore.set(patch.country);
      if (patch.language !== undefined) languageStore.set(patch.language);
    },
    synced: false,
  };
}

/** Just the storefront country (used by music search). */
export function useCountry(): string {
  return useProfile().country;
}
