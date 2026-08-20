// shared-card-view.tsx — the public share page body (/s/<token> and /s?d=…).
// Server-rendered: the poster comes straight from the validated snapshot, and
// the sharer's theme is reproduced as inline CSS variables (same map
// applyTheme uses). Only the viewer-aware CTA is a small client boundary.

import type { CSSProperties } from "react";
import Link from "next/link";

import { googleFontsHref, themeStyleVars } from "@/lib/day-of-music/theme";
import type { SharePayload } from "@/lib/day-of-music/share-links";
import {
  MonthPoster,
  StatsPoster,
  WeekPoster,
} from "@/components/day-of-music/share-posters";
import { BrandMark } from "@/components/day-of-music/atoms";
import { PosterFit } from "@/components/day-of-music/poster-fit";
import { SharedCardCta } from "@/components/day-of-music/shared-card-cta";

export function SharedCardView({ payload }: { payload: SharePayload }) {
  const vars = themeStyleVars(
    payload.theme?.aesthetic ?? "editorial",
    payload.theme?.typography ?? "editorial",
  ) as CSSProperties;

  return (
    <div className="dom-stage" style={vars}>
      {/* React hoists these to <head>; same families ensureFonts() loads. */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        rel="preconnect"
        href="https://fonts.gstatic.com"
        crossOrigin="anonymous"
      />
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
          <BrandMark />
          <span className="dom-brand-name">Day of Music</span>
          <span className="dom-brand-ko">하루의 음악</span>
        </Link>

        {/* Posters keep their full-width layout at every viewport, so on a
            phone PosterFit scales the whole card down instead of letting the
            7-day grid reflow into unreadable 44px columns. */}
        <div style={{ width: "100%", maxWidth: 1100 }}>
          <PosterFit>
            {payload.kind === "week" ? (
              <WeekPoster payload={payload} />
            ) : payload.kind === "month" ? (
              <MonthPoster payload={payload} />
            ) : (
              <StatsPoster payload={payload} />
            )}
          </PosterFit>
        </div>

        <SharedCardCta />
      </main>
    </div>
  );
}
