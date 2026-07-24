// shared-card-view.tsx — the public share page body (/s/<token> and /s?d=…).
// Server-rendered: the poster comes straight from the validated snapshot, and
// the sharer's theme is reproduced as inline CSS variables (same map
// applyTheme uses), so no client JS or providers are needed to view a card.

import type { CSSProperties } from "react";
import Link from "next/link";

import { googleFontsHref, themeStyleVars } from "@/lib/day-of-music/theme";
import type { SharePayload } from "@/lib/day-of-music/share-links";
import {
  MonthPoster,
  StatsPoster,
  WeekPoster,
} from "@/components/day-of-music/share-posters";
import { buttonClass } from "@/components/day-of-music/atoms";

export function SharedCardView({ payload }: { payload: SharePayload }) {
  const vars = themeStyleVars(
    payload.theme?.aesthetic ?? "editorial",
    payload.theme?.typography ?? "editorial",
  ) as CSSProperties;

  return (
    <div className="dom-stage" style={vars}>
      {/* React hoists these to <head>; same families ensureFonts() loads. */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="stylesheet" precedence="dom-fonts" href={googleFontsHref()} />

      <main
        className="dom-root"
        data-grid="0"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 28,
          paddingTop: 48,
          paddingBottom: 64,
        }}
      >
        <Link href="/" className="dom-signin-brand">
          <span className="dom-brand-mark">●</span>
          <span className="dom-brand-name">Day of Music</span>
          <span className="dom-brand-ko">하루의 음악</span>
        </Link>

        {/* The month grid has fixed min column widths — scroll it inside the
            card frame on narrow screens instead of overflowing the page. */}
        <div style={{ width: "100%", maxWidth: 1100, overflowX: "auto" }}>
          {payload.kind === "week" ? (
            <WeekPoster payload={payload} />
          ) : payload.kind === "month" ? (
            <MonthPoster payload={payload} />
          ) : (
            <StatsPoster payload={payload} />
          )}
        </div>

        <div className="dom-share-actions">
          <Link href="/week" className={buttonClass("solid")}>
            Make your own →
          </Link>
        </div>
      </main>
    </div>
  );
}
