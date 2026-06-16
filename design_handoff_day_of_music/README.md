# Handoff: Day of Music

A personal music journal × editorial "album of the day" calendar — log one album per day, build weekly and monthly views, and revisit a year in listening.

---

## About the Design Files

The HTML/JSX/CSS files in this bundle are **design references** — high-fidelity prototypes that demonstrate the intended look, feel, and behavior. They are not production code to copy directly.

Your job is to **recreate these designs in your codebase's existing environment** (React, Vue, SwiftUI, native iOS/Android, etc.) using its established component library, styling system, and patterns. If no environment exists yet, pick the framework that best matches the product surface (mobile-first → React Native / SwiftUI / Jetpack Compose; web → React / Vue / Svelte with CSS Modules or Tailwind).

The bundled prototype is a single-page React app rendered with Babel-in-browser purely so the design can be iterated on quickly. Do not ship Babel-in-browser to production.

## Fidelity

**High-fidelity** (hifi). Final colors, typography, spacing, hover/active states, and interactions are all specified. Recreate pixel-perfectly within the constraints of your codebase's existing design system.

## Files in this bundle

| File | Purpose |
|---|---|
| `Day of Music.html` | Entry point — open in a browser to see the prototype |
| `app.jsx` | App shell, navigation, tweaks panel wiring |
| `screens.jsx` | All screen components (Week / Month / Day Detail / Add / Profile / Search / Share Card) |
| `cover.jsx` | Typographic album cover renderer — 8 generative cover styles |
| `data.js` | Album dataset (14 albums, Jan 5–18 2026) + date helpers |
| `theme.jsx` | 4 aesthetic themes × 4 typography pairs as CSS variable token sets |
| `styles.css` | All app styles, organized by section |
| `tweaks-panel.jsx` | Floating tweaks panel (theme / typography / layout switches) |
| `ios-frame.jsx` | iOS device chrome — wraps the app when "platform = mobile" |

Open `Day of Music.html` directly in a browser (or via a static server) to interact with the prototype. Use the **Tweaks** toggle in the toolbar to switch themes, typography, layout variants, and the mobile/desktop platform frame.

---

## Concept Summary

Each day has one album. The grid is the canvas: a Mon–Sun weekly view of album covers, with a journal rail showing today's pick, your note, mood tags, and recent entries. Tap any day to open a detail modal with tracklist, journal, and info tabs. Switch to the Month view for an editorial calendar with a "pick of the month" hero, or to Search/Profile for discovery and a year-in-listening recap.

---

## Screens

### 1. Weekly Grid (default screen)

**Purpose:** Browse one album per day for the current week. Tap to open detail.

**Layout (desktop, ≥1320px):**
- Two-column page grid: main column (covers + header) + 300px right-rail (Journal).
- Main grid is 7 equal columns (`repeat(7, minmax(0, 1fr))`) with 1px borders between cells.
- Each cell: top header row (date + DOW), centered album cover (fluid, max 220px), title + artist + meta below.

**Layout (mobile / iOS frame):**
- Main grid is 2 columns. The first cell becomes a **label cell** showing `January / — Week 2 / 2026 · 큐레이션`. The remaining 7 cells fill the rest of the grid in DOW order (MON, TUE, WED, THU, FRI, SAT, SUN).
- The page-level title ("January — Week 2") is hidden on mobile so the arrows + "Share week" button sit at the top right with minimal vertical space.

**Header (`.dom-week-hd`):**
- Eyebrow: `큐레이션 · weekly view` (mono, 10px, 0.18em letter-spacing, uppercase, --ink3)
- H1: `January — Week 2` (display serif, 500 weight, 44px, -0.03em letter-spacing, line-height 1)
- Actions: prev/next icon buttons (36×36, 1px border) + "Share week" primary button

**Day cell (`.dom-day`):**
- Header row: day number (display, 13px, 600) + bar separator + DOW (mono, 11px, 0.14em) + Korean DOW right-aligned (mono, 9px)
- Body: padded 14px, centered column. Cover scales fluidly via container queries (the cover is rendered at 240px native, scaled with `transform: scale(calc(100cqw / 240px))`).
- Today: header row gets accent-color background and white text.
- Future days: 55% opacity.

**Right rail (`.dom-rail`, desktop only):**
- Sticky aside, 300px wide, three sections:
  - **Today** — eyebrow + large cover + title/artist + 5-star rating
  - **My note** — italic serif quote + mood chips
  - **Recent** — last 4 entries as 40px cover + title/artist + day number rows
- Toggleable via Tweaks → "Show journal rail"

**Interactions:**
- Cell hover: subtle `var(--chip)` background; cover lifts 2px (200ms ease).
- Click anywhere on day cell → open Day Detail modal.
- ←/→ arrow keys navigate weeks (when no modal is open).

---

### 2. Monthly Overview

**Purpose:** See the whole month as an editorial calendar with featured picks.

**Sections:**

1. **Page header (`.dom-month-hd`):**
   - Eyebrow: `한 달의 청음 · january in listening`
   - H1: "January" (display, 80px, 500, -0.04em) + "2026" inline (mono, 22px, --ink3)
   - Three stat tiles right-aligned: albums logged · % of month · genres

2. **Pick of the Month (`.dom-month-feature`):**
   - Two-column block: featured hero (left) + side picks (right, 320px column with left border).
   - **Hero:** 280px cover + meta column (eyebrow "★ pick of the month · 이달의 픽" in accent color, 42px title, 20px artist, italic 16px note with 2px accent left border, mono meta line).
   - **Side picks:** 3 additional 5-star albums as 72px cover + title/artist + day number rows.

3. **Calendar grid (`.dom-month-cal`):**
   - 7 columns, 5–6 rows of `minmax(140px, auto)` cells with 1px borders.
   - DOW header row: MON/TUE/.../SUN with Korean DOW right-aligned, --chip background.
   - Each cell: date number top-left + cover **centered with `margin: auto`** + title/artist at the bottom.
   - Out-of-month days: 35% opacity, transparent background, disabled.
   - Today: accent-tinted background, "TODAY" tag (accent color, mono, 9px, 0.18em).
   - Empty days (in-month, no album): just the date, disabled.

**Mobile:** Stacks vertically — header → single-column hero (cover above text) → side picks below → compact calendar (no title/artist, just covers).

---

### 3. Day Detail (modal)

**Purpose:** Deep-dive into a single day's album. Tabs for tracklist, journal, info.

**Trigger:** Tap any day cell, search result, monthly cell, or rail item.

**Layout:**
- Full-viewport scrim with `backdrop-filter: blur(8px)` and dark tint.
- Centered card, max 1100px wide, 90vh max-height.
- Two-column grid: 460px left panel (cover + date + format) + flexible right panel (title + tabs).

**Left panel:**
- Centered 420px cover with deep shadow (`0 24px 60px -16px rgba(0,0,0,.25)`).
- Bottom row: large date display (46px display) + DOW + "format" mono meta (this is the only place the Dolby Atmos / Lossless format line appears).

**Right panel:**
- Eyebrow: `album of the day · 오늘의 앨범`
- 48px title + 22px artist (with Korean title inline as 12px mono)
- Tabs: Tracklist · Journal · Info (mono, 10.5px, 0.14em, accent underline on active)
- **Tracklist:** numbered ordered list, 36px num + name + time, each row 10px padding, --lineSoft border-bottom
- **Journal:** rating input (5 large clickable stars) + mood chip group + editable note textarea (saves on blur via `onUpdate`)
- **Info:** Released / Genre / Format / Tracks / Logged on / Mood as label-value rows

**Interactions:**
- Escape key or click on scrim → close.
- Rating click instantly updates state via `onUpdate(albumId, { rating })`.
- Note textarea commits on blur.

---

### 4. Add / Log Album (modal)

**Purpose:** Log a new album entry in 3 steps.

**Layout:** Centered 560px modal with progress bar and animated rise.

**Steps:**

1. **Find an album**
   - Eyebrow `log an album · 새 앨범 기록`
   - Step counter `Step 1 of 3` (30px display)
   - Search input (autoFocus) + filtered result list (cover + title/artist + checkmark when selected)
   - Selected result gets accent border + chip background

2. **Pick a day**
   - 7-column date stack of the current week. Each tile: 22px day number + DOW. Selected = inverted (--ink bg, --bg text).
   - Below: preview card with cover + title/artist of the picked album.

3. **Rate + note**
   - 5-star rating input + multi-line note textarea.

**Footer:** Back / Continue (or Save entry on final step). Continue disabled until album is picked on step 1.

**Progress bar:** 2px high, accent fill, animates width (33%/66%/100%) with 250ms ease.

---

### 5. Profile / Stats (Year in Listening)

**Purpose:** A wrapped-style recap of the user's listening history.

**Layout:**
- Standard week-style header (`올해의 청음 · 2026 in listening` + "My Year in Music" + Export/Share Card buttons).
- 4-column stats grid:
  - **Large stat (spans 2×2):** "albums logged" + huge 168px number + sub copy
  - **Average rating:** 96px number + 5-star row
  - **Five-star picks:** 96px number + percentage
  - **Top genres (spans 2):** label + horizontal bar chart (110px label + bar track + count)
  - **Mood map (spans 2):** mood cloud — each mood scaled by frequency (14 + n*4 px)
- Below: "Five stars · 다섯별 앨범" section — 5-column grid of covers + title/artist.

**Mobile:** Stats grid collapses to 2 columns, large stat shrinks proportionally, fives grid to 3 columns.

---

### 6. Search / Discover

**Purpose:** Filter and find albums in the journal.

**Layout:**
- Header (`발견 · discover` + "Search the journal")
- Large search input (18px, generous padding)
- Genre chip row (`All` + each unique genre) — chips are mono-cased small caps, active state = inverted
- Vertical result list: each row = 120px cover + title/artist/meta/stars + right-aligned day number

---

### 7. Share Week / Month Card (modal)

**Purpose:** Preview a shareable poster of the user's week or month.

**Layout:**
- 540px white card with deep shadow.
- Header: "DAY · OF · MUSIC" eyebrow + "January · Week 2" title + @handle.
- 4-column grid of cover + title/artist.
- Footer: counts + average star rating.
- Actions below card: Copy link + Save image.

---

## Themes (CSS variable token sets)

Theme is applied by setting CSS custom properties on the `.dom-root` element. Four aesthetics × four typography pairs.

### Aesthetics

| Token | Editorial | Minimal | Vibrant | Dark |
|---|---|---|---|---|
| `--bg` | `#efe6d2` | `#fafaf8` | `#f4f0e8` | `#121110` |
| `--panel` | `#f6efe0` | `#ffffff` | `#ffffff` | `#1a1816` |
| `--ink` | `#1a1612` | `#1c1c1a` | `#0d0d0d` | `#f1ebd9` |
| `--ink2` | `#564a36` | `#5e5e58` | `#3d3d3d` | `#a89e87` |
| `--ink3` | `#8a7a5d` | `#9b9b94` | `#7a7a7a` | `#6b6557` |
| `--line` | `#1a1612` | `#1c1c1a` | `#0d0d0d` | `#f1ebd9` |
| `--lineSoft` | `rgba(26,22,18,.22)` | `rgba(28,28,26,.10)` | `rgba(13,13,13,.16)` | `rgba(241,235,217,.16)` |
| `--accent` | `#7a3b2e` | `#1c1c1a` | `#ff4d3d` | `#e6b34a` |
| `--chip` | `rgba(26,22,18,.06)` | `rgba(28,28,26,.05)` | `rgba(255,77,61,.10)` | `rgba(241,235,217,.06)` |
| Background grid lines | ✅ | ❌ | ❌ | ✅ |
| Cover radius | 0 | 6px | 0 | 0 |

The editorial and dark themes paint a 56×56px grid via two linear-gradients using `--lineSoft` for a subtle paper effect.

### Typography pairs (Google Fonts)

| Key | Display + Body | Mono | Notes |
|---|---|---|---|
| `editorial` | Spectral (300/400/500/600/700) | JetBrains Mono | Default — matches reference |
| `modern` | Manrope (300–800) | JetBrains Mono | Cleaner, contemporary |
| `display` | Bricolage Grotesque (300–800) | JetBrains Mono | Editorial display sans |
| `classic` | Cormorant Garamond (300–700) | Geist Mono | Quiet, bookish |

Fonts are injected via a single `<link>` tag in `ensureFonts()` (theme.jsx) and applied as `--font-display`, `--font-body`, `--font-mono`, `--font-sans` on the root.

---

## Design Tokens

### Spacing
- Page padding: 28px desktop / 18px tablet / 12px mobile
- Section gap: 24px desktop / 16px tablet / 10px mobile
- Card inner padding: 14px–32px depending on size
- Border width: always 1px (the prototype uses sharp 1px borders, never thicker)

### Type scale
- Hero stat: 168px
- Big stat: 96px
- Editorial title: 44–48px
- Section title: 28px
- Detail title: 30–48px
- Body: 14–16px
- Mono small caps (eyebrow/meta): 9–11px with 0.10–0.18em letter-spacing
- Korean copy is consistently 9–11px mono, --ink3, with 0.10–0.15em letter-spacing

### Radii
- Editorial / Vibrant / Dark themes: **0** (everything is sharp).
- Minimal theme: 6px on covers, 0 elsewhere.
- The whole product is intentionally low-radius — do not introduce rounded cards or pill buttons.

### Shadows
- Cover shadow: theme-driven (`--coverShadow`)
  - Editorial: `0 1px 2px rgba(0,0,0,.06)` (paper-thin)
  - Minimal: `0 8px 24px -8px rgba(0,0,0,.12)` (lifted card)
  - Vibrant: `0 12px 32px -10px rgba(0,0,0,.18), 0 0 0 1px rgba(0,0,0,.04)` (poster)
  - Dark: `0 16px 48px -12px rgba(0,0,0,.6)` (deep)
- Detail-modal cover shadow: `0 24px 60px -16px rgba(0,0,0,.25)` (always large)

### Transitions
- Default: 120ms ease for background-color / border-color
- Hover lifts: 200ms ease on `transform: translateY(-2px)`
- Modal rise: 250ms ease from `translateY(12px); opacity: 0` to natural
- Scrim fade in: 200ms ease

---

## Album Covers — Typographic, Not Bitmap

The prototype does **not** use real album artwork. Covers are generated from typography + flat colors using 8 layout styles (`stack`, `diag`, `center`, `split`, `edge`, `ring`, `block`, `ticker`). Each album has a `cover: { style, bg, fg, accent }` object in `data.js`.

When implementing for production, replace the `<Cover>` component with whatever your codebase uses for real album artwork (Apple Music / Spotify metadata, user upload, etc.). The fluid sizing pattern (`<div style="container-type: inline-size">` with a 240px native child scaled via `calc(100cqw / 240px)`) should be kept — it's what makes the covers work at every size from 40px (rail row) to 420px (detail) without recomputing pixel sizes.

If you keep the typographic style as a fallback for missing artwork, see `cover.jsx` for the 8 style implementations.

---

## State Management

The prototype uses local React state. For production:

```
journal entries: {
  id: string,
  albumId: string (or full album metadata),
  date: 'YYYY-MM-DD',
  rating: 1–5,
  note: string,
  mood: string[],
  createdAt: timestamp,
}
```

Operations:
- `addEntry({ albumId, date, rating, note })`
- `updateEntry(id, patch)` — called on rating change (instant) and note blur
- `getByWeek(weekStart)` and `getByMonth(year, month)` — used by Week and Month views

The "today" reference date in the prototype is hardcoded to **Jan 8, 2026** (`new Date(2026, 0, 8)`). In production, derive from `new Date()`.

---

## Interactions & Behavior

| Surface | Trigger | Behavior |
|---|---|---|
| Day cell | Click | Open Day Detail modal |
| Day cell | Hover | bg → --chip, cover lifts 2px |
| Weekly header arrows | Click | ±7 days |
| Whole page | ←/→ keys | ±7 days (when no modal open) |
| Whole page | Esc | Close any open modal |
| Detail tabs | Click | Switch tab |
| Rating star | Click | `onUpdate(albumId, { rating })` |
| Note textarea | Blur | `onUpdate(albumId, { note })` |
| Add flow Continue | Click | Advance step; disabled when step 1 has no pick |
| Add flow Save entry | Click | `onSave({ id, date, rating, note })` then close |
| Search input | Type | Filter results live (title + artist + mood string match) |
| Genre chip | Click | Filter by genre |
| "Share week/month" | Click | Open ShareCard modal |

---

## Responsive Breakpoints

| Width | Behavior |
|---|---|
| ≥1320px | Two-column page grid: main + 300px Journal rail |
| 1100–1319px | Rail hidden; weekly grid becomes 4 columns |
| 760–1099px | Weekly grid 4 cols; monthly wall 4 cols; profile stats 2 cols |
| <760px | Weekly grid 2 cols (label cell shows month + week + year); profile stats 2 cols |
| iOS frame (always) | Wraps the whole app in `<IOSDevice>`; topbar collapses to 2 rows (brand+button row + nav row); week label cell visible in grid |

---

## Notes for Implementation

- **Korean copy** is intentional editorial styling, not just localization placeholders. Pair Korean labels with the English equivalents (`발견 · discover`, `오늘의 앨범`, `메모`, `다섯별`). If your product is single-language, drop the Korean half rather than auto-translating everything — the mono small-caps Korean is part of the visual rhythm.
- **No emoji.** The cover style indicators (★ ◐ ↻) are intentional typographic marks — not emoji. If your design system blocks these, replace with custom inline SVGs.
- **No rounded corners** anywhere by default. Sharp 1px borders are core to the editorial feel.
- **Container queries** are used for cover sizing. If your codebase targets browsers without container query support (Safari <16, Chrome <105), use a JS ResizeObserver fallback or fixed-pixel cover sizes per breakpoint.
- **Format line** ("Dolby Atmos · Lossless") only appears on the Day Detail page — never on grid cards. Genre and year are the only meta shown on cards.
- The "Days shown" tweak was removed; weekly grid is always 7 days. List layout always shows the whole month.

---

## Assets

No external image assets. All graphics are CSS, typography, and SVG generated in code. Fonts are loaded from Google Fonts.

For production: source album artwork from your music platform API. Match aspect ratio (1:1). Keep the box-shadow stack from `--coverShadow` so covers feel like physical objects, not flat thumbnails.
