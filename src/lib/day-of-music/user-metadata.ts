// user-metadata.ts — what this app keeps in a Supabase account's
// user_metadata (the preferences that sync across devices), and the one place
// that reads it. supabase-js types user_metadata as `any`, so each field is
// checked here and comes back undefined when it's missing or malformed.

import type { User } from "@supabase/supabase-js";

import type { BestOfMap } from "@/lib/day-of-music/best-of-bracket";
import { LOCALES, type LanguagePref } from "@/lib/day-of-music/i18n-core";
import type { Theme } from "@/lib/day-of-music/themes";

export type UserMetadata = {
  username?: string;
  /** Apple Music storefront, ISO 3166-1 alpha-2. */
  country?: string;
  language?: LanguagePref;
  themes?: Theme[];
  /** Best-of results from before public.best_of: moved to the table on the
   *  next load, then cleared to null (see useBestOf). */
  bestOf?: BestOfMap | null;
};

function isLanguagePref(value: unknown): value is LanguagePref {
  return value === "auto" || LOCALES.some((l) => l.code === value);
}

export function readUserMetadata(user: User): UserMetadata {
  const meta: Record<string, unknown> = user.user_metadata ?? {};
  return {
    username: typeof meta.username === "string" ? meta.username : undefined,
    country: typeof meta.country === "string" ? meta.country : undefined,
    language: isLanguagePref(meta.language) ? meta.language : undefined,
    themes: Array.isArray(meta.themes) ? (meta.themes as Theme[]) : undefined,
    bestOf:
      meta.bestOf && typeof meta.bestOf === "object" ? (meta.bestOf as BestOfMap) : undefined,
  };
}
