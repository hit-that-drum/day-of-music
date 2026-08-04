// language-switch.tsx — header control for the UI language. Deliberately its
// own element in the top bar (separate from the Tweaks panel). Picking a
// language writes an explicit preference that overrides the country default.

"use client";

import { DomSelect } from "@/components/day-of-music/dom-select";
import { LOCALES, useLanguage, useT, type Locale } from "@/lib/day-of-music/i18n";

// Endonym + short code so the dropdown is friendly ("한국어 · KO") while the
// trigger stays compact.
const LANG_OPTIONS = LOCALES.map((l) => ({
  value: l.code,
  label: `${l.native} · ${l.label}`,
}));

export function LanguageSwitch() {
  const { locale, setLanguage } = useLanguage();
  const t = useT();

  return (
    <div className="dom-lang-switch">
      <DomSelect
        ariaLabel={t("lang.label")}
        value={locale}
        options={LANG_OPTIONS}
        onChange={(v) => setLanguage(v as Locale)}
      />
    </div>
  );
}
