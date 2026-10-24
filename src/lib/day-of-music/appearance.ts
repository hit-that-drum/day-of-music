// appearance.ts — the look the Tweaks panel picks: four aesthetic directions ×
// four typography pairs, written as CSS custom properties on the .dom-stage
// frame (inline, see themeStyleVars) so the app and its modals theme uniformly.
// Not to be confused with themes.ts, the journal's lanes.

// Tuples, so the share-link schema validates a shared theme against the same
// keys AESTHETICS / TYPE_PAIRS (below) must define.
export const AESTHETIC_KEYS = ["editorial", "minimal", "vibrant", "dark"] as const;
export type AestheticKey = (typeof AESTHETIC_KEYS)[number];
export const TYPE_KEYS = ["editorial", "modern", "display", "classic"] as const;
export type TypeKey = (typeof TYPE_KEYS)[number];

type AestheticTokens = {
  bg: string;
  panel: string;
  ink: string;
  ink2: string;
  ink3: string;
  line: string;
  lineSoft: string;
  accent: string;
  chip: string;
  gridShow: boolean;
  coverShadow: string;
  coverRadius: number;
};

type Aesthetic = {
  label: string;
  tokens: AestheticTokens;
};

export const AESTHETICS: Record<AestheticKey, Aesthetic> = {
  editorial: {
    label: "Editorial",
    tokens: {
      bg: "#efe6d2",
      panel: "#f6efe0",
      ink: "#1a1612",
      ink2: "#564a36",
      ink3: "#8a7a5d",
      line: "#1a1612",
      lineSoft: "rgba(26,22,18,.22)",
      accent: "#7a3b2e",
      chip: "rgba(26,22,18,.06)",
      gridShow: true,
      coverShadow: "0 1px 2px rgba(0,0,0,.06)",
      coverRadius: 0,
    },
  },
  minimal: {
    label: "Minimal",
    tokens: {
      bg: "#fafaf8",
      panel: "#ffffff",
      ink: "#1c1c1a",
      ink2: "#5e5e58",
      ink3: "#9b9b94",
      line: "#1c1c1a",
      lineSoft: "rgba(28,28,26,.10)",
      accent: "#1c1c1a",
      chip: "rgba(28,28,26,.05)",
      gridShow: false,
      coverShadow: "0 8px 24px -8px rgba(0,0,0,.12)",
      coverRadius: 6,
    },
  },
  vibrant: {
    label: "Vibrant",
    tokens: {
      bg: "#f4f0e8",
      panel: "#ffffff",
      ink: "#0d0d0d",
      ink2: "#3d3d3d",
      ink3: "#7a7a7a",
      line: "#0d0d0d",
      lineSoft: "rgba(13,13,13,.16)",
      accent: "#ff4d3d",
      chip: "rgba(255,77,61,.10)",
      gridShow: false,
      coverShadow: "0 12px 32px -10px rgba(0,0,0,.18), 0 0 0 1px rgba(0,0,0,.04)",
      coverRadius: 0,
    },
  },
  dark: {
    label: "Dark",
    tokens: {
      bg: "#121110",
      panel: "#1a1816",
      ink: "#f1ebd9",
      ink2: "#a89e87",
      ink3: "#6b6557",
      line: "#f1ebd9",
      lineSoft: "rgba(241,235,217,.16)",
      accent: "#e6b34a",
      chip: "rgba(241,235,217,.06)",
      gridShow: true,
      coverShadow: "0 16px 48px -12px rgba(0,0,0,.6)",
      coverRadius: 0,
    },
  },
};

type TypePair = {
  label: string;
  display: string;
  body: string;
  mono: string;
  googleFonts: string[];
};

export const TYPE_PAIRS: Record<TypeKey, TypePair> = {
  editorial: {
    label: "Spectral / JetBrains Mono",
    display: '"Spectral", Georgia, serif',
    body: '"Spectral", Georgia, serif',
    mono: '"JetBrains Mono", ui-monospace, monospace',
    googleFonts: ["Spectral:wght@300;400;500;600;700", "JetBrains+Mono:wght@400;500;600"],
  },
  modern: {
    label: "Manrope / JetBrains Mono",
    display: '"Manrope", system-ui, sans-serif',
    body: '"Manrope", system-ui, sans-serif',
    mono: '"JetBrains Mono", ui-monospace, monospace',
    googleFonts: ["Manrope:wght@300;400;500;600;700;800", "JetBrains+Mono:wght@400;500;600"],
  },
  display: {
    label: "Bricolage / JetBrains Mono",
    display: '"Bricolage Grotesque", system-ui, sans-serif',
    body: '"Bricolage Grotesque", system-ui, sans-serif',
    mono: '"JetBrains Mono", ui-monospace, monospace',
    googleFonts: ["Bricolage+Grotesque:wght@300;400;500;600;700;800", "JetBrains+Mono:wght@400;500;600"],
  },
  classic: {
    label: "Cormorant / Geist Mono",
    display: '"Cormorant Garamond", Georgia, serif',
    body: '"Cormorant Garamond", Georgia, serif',
    mono: '"Geist Mono", ui-monospace, monospace',
    googleFonts: ["Cormorant+Garamond:wght@300;400;500;600;700", "Geist+Mono:wght@400;500;600"],
  },
};

// The Google Fonts stylesheet URL covering every theme's families. Shared by
// the root layout's <link> and the share-card export (fontEmbedCSS).
export function googleFontsHref(): string {
  const all = new Set<string>();
  Object.values(TYPE_PAIRS).forEach((t) => t.googleFonts.forEach((g) => all.add(g)));
  return (
    "https://fonts.googleapis.com/css2?" +
    Array.from(all)
      .map((f) => `family=${f}`)
      .join("&") +
    "&display=swap"
  );
}

// The full CSS-variable map for a theme, keyed by custom-property name — the
// inline style of a .dom-stage frame: the app's (the user's Tweaks) and the
// public share page's (the sharer's, so the card matches their theme).
export function themeStyleVars(
  aestheticKey: AestheticKey,
  typeKey: TypeKey,
): Record<string, string> {
  const a = AESTHETICS[aestheticKey] ?? AESTHETICS.editorial;
  const t = TYPE_PAIRS[typeKey] ?? TYPE_PAIRS.editorial;
  const vars: Record<string, string> = {};

  (Object.entries(a.tokens) as [keyof AestheticTokens, string | number | boolean][]).forEach(
    ([k, v]) => {
      vars[`--${k}`] = typeof v === "boolean" ? (v ? "1" : "0") : String(v);
    },
  );
  vars["--font-display"] = t.display;
  vars["--font-body"] = t.body;
  vars["--font-mono"] = t.mono;
  vars["--cover-display"] = t.display;
  vars["--cover-mono"] = t.mono;
  return vars;
}
