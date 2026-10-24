// storefront.ts — Apple Music storefronts: the countries catalog search can
// target, and the best guess at the listener's own from the browser. Pure (no
// React, no account), so modules above the profile hooks can use it too.

export const DEFAULT_COUNTRY = "US";

// Apple Media Services (Apple Music) storefronts — ISO 3166-1 alpha-2. Country
// libraries list every ISO country, but only these have an Apple Music store,
// so we filter the picker to them. Update from Apple's storefront list if it
// changes.
export const APPLE_STOREFRONTS = new Set<string>([
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
