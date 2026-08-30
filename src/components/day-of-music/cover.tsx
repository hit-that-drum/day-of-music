// cover.tsx — Typographic album cover renderer.
// Renders an original 1:1 cover per album from a declarative style hint — pure
// type + color compositions, no bitmap artwork. The inner cover is laid out at a
// 240px native size and scaled to any size via a container query.

import type { CSSProperties } from "react";

import type { Album } from "@/lib/day-of-music/data";

const NATIVE = 240;

const DISPLAY = 'var(--cover-display, "Spectral", Georgia, serif)';
const MONO = 'var(--cover-mono, "JetBrains Mono", monospace)';

type CoverProps = {
  album: Album;
  /** Pixel size, or "100%" to fill the container fluidly (1:1). */
  size?: number | "100%";
};

type StyleArgs = {
  s: number;
  title: string;
  artist: string;
  fg: string;
  accent: string;
  bg: string;
};

export function Cover({ album, size = 240 }: CoverProps) {
  const { cover, title, artist, artworkUrl } = album;
  const { style, bg, fg, accent } = cover;
  const args: StyleArgs = { s: NATIVE, title, artist, fg, accent, bg };

  // Real artwork (e.g. iTunes search results) wins over the typographic tile.
  const inner = artworkUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={artworkUrl}
      alt={`${title} — ${artist}`}
      width={NATIVE}
      height={NATIVE}
      // anonymous CORS keeps the canvas untainted for html-to-image export
      crossOrigin="anonymous"
      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
    />
  ) : (
    renderStyle(style, args)
  );
  const useFluid = size === "100%";

  return (
    <div
      className="dom-cover"
      style={{
        width: useFluid ? "100%" : size,
        // A padding-box square rather than `aspect-ratio`. This element also
        // carries `container-type: inline-size`, which applies block-size
        // containment — the height is computed as if the box had no contents,
        // so it comes from the aspect ratio alone. WebKit collapses that pairing
        // to zero height, which is why every cover in the monthly calendar
        // vanished in Safari while Chrome rendered them fine. A percentage
        // padding resolves against the width in every engine and is unaffected
        // by containment, so the square survives the same containment.
        height: useFluid ? 0 : size,
        paddingTop: useFluid ? "100%" : undefined,
        position: "relative",
        overflow: "hidden",
        containerType: "inline-size",
        flex: "none",
        borderRadius: "var(--coverRadius, 0px)",
      }}
    >
      <div
        className="dom-cover-inner"
        style={{
          width: NATIVE,
          height: NATIVE,
          background: bg,
          color: fg,
          position: "absolute",
          top: 0,
          left: 0,
          transformOrigin: "0 0",
          transform: `scale(calc(100cqw / ${NATIVE}px))`,
        }}
      >
        {inner}
      </div>
    </div>
  );
}

function renderStyle(style: Album["cover"]["style"], a: StyleArgs) {
  switch (style) {
    case "diag":
      return <DiagStyle {...a} />;
    case "center":
      return <CenterStyle {...a} />;
    case "split":
      return <SplitStyle {...a} />;
    case "edge":
      return <EdgeStyle {...a} />;
    case "ring":
      return <RingStyle {...a} />;
    case "block":
      return <BlockStyle {...a} />;
    case "ticker":
      return <TickerStyle {...a} />;
    case "stack":
    default:
      return <StackStyle {...a} />;
  }
}

const abs: CSSProperties = { position: "absolute", inset: 0 };

// ── stack — title stacked, large, bottom-anchored
function StackStyle({ title, fg, accent }: StyleArgs) {
  return (
    <div
      style={{
        ...abs,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
      }}
    >
      <div
        style={{
          fontFamily: DISPLAY,
          fontSize: 48,
          fontWeight: 500,
          lineHeight: 0.92,
          color: fg,
          letterSpacing: "-0.02em",
          textTransform: "lowercase",
          wordBreak: "break-word",
        }}
      >
        {title}
      </div>
      <div
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          right: 16,
          display: "flex",
          justifyContent: "space-between",
          fontFamily: MONO,
          fontSize: 9,
          letterSpacing: ".1em",
          color: accent,
          textTransform: "uppercase",
        }}
      >
        <span>{"★".repeat(3)}</span>
        <span>SIDE A</span>
      </div>
    </div>
  );
}

// ── diag — title rotated, modernist
function DiagStyle({ title, artist, fg, accent }: StyleArgs) {
  return (
    <div style={abs}>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%,-50%) rotate(-12deg)",
          fontFamily: DISPLAY,
          fontSize: 34,
          fontWeight: 600,
          color: fg,
          letterSpacing: "-0.02em",
          textAlign: "center",
          width: "120%",
          textTransform: "uppercase",
        }}
      >
        {title}
      </div>
      <div
        style={{
          position: "absolute",
          left: 14,
          top: 14,
          fontFamily: MONO,
          fontSize: 9,
          letterSpacing: ".15em",
          color: accent,
        }}
      >
        ◐ {artist.toUpperCase()}
      </div>
      <div
        style={{
          position: "absolute",
          right: 14,
          bottom: 14,
          fontFamily: MONO,
          fontSize: 9,
          letterSpacing: ".15em",
          color: accent,
        }}
      >
        LP · 33⅓
      </div>
    </div>
  );
}

// ── center — symmetric monogram
function CenterStyle({ title, fg, accent }: StyleArgs) {
  const initials = title
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 3);
  return (
    <div style={{ ...abs, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          width: 140,
          height: 140,
          borderRadius: "50%",
          border: `1px solid ${accent}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            fontFamily: DISPLAY,
            fontSize: 72,
            fontWeight: 500,
            color: fg,
            lineHeight: 1,
            letterSpacing: "-0.04em",
          }}
        >
          {initials}
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 14,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: MONO,
          fontSize: 8.5,
          letterSpacing: ".2em",
          color: accent,
          textTransform: "uppercase",
        }}
      >
        {title}
      </div>
    </div>
  );
}

// ── split — diagonal color split + text
function SplitStyle({ s, title, artist, fg, accent }: StyleArgs) {
  return (
    <div style={abs}>
      <svg width={s} height={s} style={{ position: "absolute", inset: 0 }}>
        <polygon points={`0,${s} 0,0 ${s},${s}`} fill={accent} opacity="0.45" />
      </svg>
      <div
        style={{
          position: "absolute",
          left: 14,
          bottom: 14,
          fontFamily: DISPLAY,
          fontSize: 28,
          fontWeight: 500,
          color: fg,
          lineHeight: 1,
          letterSpacing: "-0.02em",
          maxWidth: 180,
        }}
      >
        {title}
      </div>
      <div
        style={{
          position: "absolute",
          right: 14,
          top: 14,
          textAlign: "right",
          fontFamily: MONO,
          fontSize: 9,
          letterSpacing: ".12em",
          color: fg,
          opacity: 0.8,
          textTransform: "uppercase",
        }}
      >
        {artist}
        <br />
        <span style={{ opacity: 0.55 }}>—</span>
      </div>
    </div>
  );
}

// ── edge — vertical title along left edge
function EdgeStyle({ title, artist, fg, accent }: StyleArgs) {
  return (
    <div style={abs}>
      <div
        style={{
          position: "absolute",
          top: 14,
          bottom: 14,
          left: 18,
          writingMode: "vertical-rl",
          transform: "rotate(180deg)",
          fontFamily: DISPLAY,
          fontSize: 28,
          fontWeight: 500,
          color: fg,
          letterSpacing: "-0.01em",
          lineHeight: 1,
        }}
      >
        {title}
      </div>
      <div
        style={{
          position: "absolute",
          right: 14,
          bottom: 14,
          textAlign: "right",
          fontFamily: MONO,
          fontSize: 9,
          letterSpacing: ".15em",
          color: accent,
          textTransform: "uppercase",
        }}
      >
        {artist}
      </div>
      <div
        style={{
          position: "absolute",
          right: 14,
          top: 14,
          width: 28,
          height: 28,
          borderRadius: "50%",
          border: `1px solid ${accent}`,
        }}
      />
    </div>
  );
}

// ── ring — concentric arcs
function RingStyle({ s, title, artist, fg, accent }: StyleArgs) {
  return (
    <div style={abs}>
      <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
        {[0.85, 0.65, 0.42, 0.22].map((r, i) => (
          <circle
            key={i}
            cx={s / 2}
            cy={s / 2}
            r={(s * r) / 2}
            fill="none"
            stroke={i % 2 === 0 ? accent : fg}
            strokeWidth={0.6}
            opacity={0.6 - i * 0.1}
          />
        ))}
        <circle cx={s / 2} cy={s / 2} r={6} fill={fg} />
      </svg>
      <div
        style={{
          position: "absolute",
          bottom: 14,
          left: 14,
          right: 14,
          display: "flex",
          justifyContent: "space-between",
          fontFamily: MONO,
          fontSize: 9,
          letterSpacing: ".15em",
          color: fg,
          textTransform: "uppercase",
        }}
      >
        <span>{artist}</span>
        <span style={{ color: accent }}>{title}</span>
      </div>
    </div>
  );
}

// ── block — bold modernist type, full-bleed title
function BlockStyle({ title, artist, fg, accent }: StyleArgs) {
  return (
    <div
      style={{
        ...abs,
        padding: 14,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <div
        style={{
          fontFamily: MONO,
          fontSize: 9,
          letterSpacing: ".18em",
          color: accent,
          textTransform: "uppercase",
        }}
      >
        {artist} · LP
      </div>
      <div
        style={{
          fontFamily: DISPLAY,
          fontSize: 30,
          fontWeight: 700,
          color: fg,
          lineHeight: 0.95,
          letterSpacing: "-0.025em",
          textTransform: "uppercase",
        }}
      >
        {title}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div style={{ width: 40, height: 2, background: accent }} />
        <div
          style={{
            fontFamily: MONO,
            fontSize: 8.5,
            letterSpacing: ".12em",
            color: fg,
            opacity: 0.7,
          }}
        >
          A | B
        </div>
      </div>
    </div>
  );
}

// ── ticker — title repeated like a marquee
function TickerStyle({ title, artist, fg, accent }: StyleArgs) {
  const reps = Array.from({ length: 8 });
  return (
    <div style={{ ...abs, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: 0,
          right: 0,
          transform: "translateY(-50%)",
          fontFamily: DISPLAY,
          fontSize: 30,
          fontWeight: 600,
          color: fg,
          whiteSpace: "nowrap",
          textTransform: "uppercase",
          letterSpacing: "-0.01em",
        }}
      >
        {reps.map((_, i) => (
          <span key={i} style={{ opacity: i === 0 ? 1 : 0.25 - i * 0.02 }}>
            {title} ·{" "}
          </span>
        ))}
      </div>
      <div
        style={{
          position: "absolute",
          top: 14,
          left: 14,
          fontFamily: MONO,
          fontSize: 9,
          letterSpacing: ".15em",
          color: accent,
          textTransform: "uppercase",
        }}
      >
        {artist}
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 14,
          right: 14,
          fontFamily: MONO,
          fontSize: 9,
          letterSpacing: ".15em",
          color: accent,
        }}
      >
        ↻ ↻ ↻
      </div>
    </div>
  );
}
