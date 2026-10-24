// day-of-music.ts — the app stylesheet, one file per section under ./dom/,
// imported here in cascade order. Later files win ties between equally
// specific rules, so the order is load-bearing (the phone, sheet and landscape
// passes come last on purpose). Imported from JS rather than through CSS
// @import: an @import would hand the files to Tailwind's PostCSS plugin, which
// rewrites them (color-mix fallbacks), unlike how this sheet was always built.
// Themes are applied via CSS variables set inline on .dom-stage from
// lib/day-of-music/appearance.ts.

import "./dom/00-base.css";
import "./dom/01-root-frame.css";
import "./dom/02-top-bar.css";
import "./dom/03-main.css";
import "./dom/04-select-field.css";
import "./dom/05-buttons-inputs.css";
import "./dom/06-weekly-grid.css";
import "./dom/07-week-picker.css";
import "./dom/08-day-reschedule.css";
import "./dom/09-drag-and-drop.css";
import "./dom/10-monthly-view.css";
import "./dom/11-profile-stats.css";
import "./dom/12-search.css";
import "./dom/13-day-detail.css";
import "./dom/14-modal.css";
import "./dom/15-add-flow.css";
import "./dom/16-manual-entry.css";
import "./dom/17-share-card.css";
import "./dom/18-signin.css";
import "./dom/19-tweaks-panel.css";
import "./dom/20-responsive.css";
import "./dom/21-phone-pass.css";
import "./dom/22-home-landing.css";
import "./dom/23-legal.css";
import "./dom/24-empty-days.css";
import "./dom/25-best-of.css";
import "./dom/26-mobile-shell-hooks.css";
import "./dom/27-mobile-shell.css";
import "./dom/28-bottom-sheets.css";
import "./dom/29-phone-landscape.css";
