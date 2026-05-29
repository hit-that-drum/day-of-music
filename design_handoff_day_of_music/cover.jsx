// cover.jsx — Typographic album cover renderer.
// Renders an original 1:1 cover for each album based on a declarative style hint.
// No photos, no reproduction of real artwork — pure type + color compositions.

function Cover({ album, size = 240, showSticker = false, stickerLabel = 'E' }) {
  const { cover, title, artist } = album;
  const { style, bg, fg, accent } = cover;

  // Render inner cover at 240px native — the wrapping <div> is sized to `size`
  // and scales the inner via CSS calc(width / 240px) so any size works.
  const NATIVE = 240;
  const s = NATIVE;
  const f = (n) => n;

  const inner = (() => {
    switch (style) {
      case 'stack': return <StackStyle s={s} f={f} title={title} artist={artist} fg={fg} accent={accent} />;
      case 'diag': return <DiagStyle s={s} f={f} title={title} artist={artist} fg={fg} accent={accent} />;
      case 'center': return <CenterStyle s={s} f={f} title={title} artist={artist} fg={fg} accent={accent} />;
      case 'split': return <SplitStyle s={s} f={f} title={title} artist={artist} fg={fg} accent={accent} bg={bg} />;
      case 'edge': return <EdgeStyle s={s} f={f} title={title} artist={artist} fg={fg} accent={accent} />;
      case 'ring': return <RingStyle s={s} f={f} title={title} artist={artist} fg={fg} accent={accent} />;
      case 'block': return <BlockStyle s={s} f={f} title={title} artist={artist} fg={fg} accent={accent} />;
      case 'ticker': return <TickerStyle s={s} f={f} title={title} artist={artist} fg={fg} accent={accent} />;
      default: return <StackStyle s={s} f={f} title={title} artist={artist} fg={fg} accent={accent} />;
    }
  })();

  // Outer = the size box (the caller styles its width/height via `size` or CSS).
  // It's a container-query context so the inner can scale itself with `cqw`.
  const useFluidSize = size === '100%';
  return (
    <div
      className="dom-cover"
      style={{
        width: useFluidSize ? '100%' : size,
        height: useFluidSize ? undefined : size,
        aspectRatio: useFluidSize ? '1 / 1' : undefined,
        position: 'relative',
        overflow: 'hidden',
        containerType: 'inline-size',
        flex: 'none',
      }}
    >
      <div
        className="dom-cover-inner"
        style={{
          width: NATIVE, height: NATIVE, background: bg, color: fg,
          position: 'absolute', top: 0, left: 0,
          transformOrigin: '0 0',
          // calc(length / length) -> unitless number, valid for scale()
          transform: `scale(calc(100cqw / ${NATIVE}px))`,
        }}
      >
        {inner}
        {showSticker && (
          <div style={{
            position: 'absolute', right: 8, bottom: 8,
            background: 'rgba(0,0,0,.55)', color: '#fff',
            fontFamily: 'ui-sans-serif, system-ui',
            fontSize: 10, fontWeight: 600, letterSpacing: '.04em',
            padding: `2px 5px`, borderRadius: 2,
          }}>{stickerLabel}</div>
        )}
      </div>
    </div>
  );
}

// ── Style: stack — title stacked vertically, large
function StackStyle({ s, f, title, fg, accent }) {
  return (
    <div style={{ position: 'absolute', inset: 0, padding: f(16), display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div style={{
        fontFamily: 'var(--cover-display, "Spectral", Georgia, serif)',
        fontSize: f(48), fontWeight: 500, lineHeight: 0.92, color: fg,
        letterSpacing: '-0.02em', textTransform: 'lowercase',
        wordBreak: 'break-word',
      }}>{title}</div>
      <div style={{
        position: 'absolute', top: f(16), left: f(16), right: f(16),
        display: 'flex', justifyContent: 'space-between',
        fontFamily: 'var(--cover-mono, "JetBrains Mono", monospace)',
        fontSize: f(9), letterSpacing: '.1em', color: accent, textTransform: 'uppercase',
      }}>
        <span>{'★'.repeat(3)}</span>
        <span>SIDE A</span>
      </div>
    </div>
  );
}

// ── Style: diag — title rotated, modernist
function DiagStyle({ s, f, title, artist, fg, accent }) {
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div style={{
        position: 'absolute', left: '50%', top: '50%',
        transform: 'translate(-50%,-50%) rotate(-12deg)',
        fontFamily: 'var(--cover-display, "Spectral", Georgia, serif)',
        fontSize: f(34), fontWeight: 600, color: fg,
        letterSpacing: '-0.02em', textAlign: 'center', width: '120%',
        textTransform: 'uppercase',
      }}>{title}</div>
      <div style={{
        position: 'absolute', left: f(14), top: f(14),
        fontFamily: 'var(--cover-mono, "JetBrains Mono", monospace)',
        fontSize: f(9), letterSpacing: '.15em', color: accent,
      }}>◐ {artist.toUpperCase()}</div>
      <div style={{
        position: 'absolute', right: f(14), bottom: f(14),
        fontFamily: 'var(--cover-mono, "JetBrains Mono", monospace)',
        fontSize: f(9), letterSpacing: '.15em', color: accent,
      }}>LP · 33⅓</div>
    </div>
  );
}

// ── Style: center — symmetric, monogram
function CenterStyle({ s, f, title, artist, fg, accent }) {
  const initials = title.split(' ').map(w => w[0]).join('').slice(0, 3);
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{
        width: f(140), height: f(140), borderRadius: '50%',
        border: `${f(1)}px solid ${accent}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          fontFamily: 'var(--cover-display, "Spectral", Georgia, serif)',
          fontSize: f(72), fontWeight: 500, color: fg,
          lineHeight: 1, letterSpacing: '-0.04em',
        }}>{initials}</div>
      </div>
      <div style={{
        position: 'absolute', bottom: f(14), left: 0, right: 0,
        textAlign: 'center',
        fontFamily: 'var(--cover-mono, "JetBrains Mono", monospace)',
        fontSize: f(8.5), letterSpacing: '.2em', color: accent, textTransform: 'uppercase',
      }}>{title}</div>
    </div>
  );
}

// ── Style: split — diagonal color split + text
function SplitStyle({ s, f, title, artist, fg, accent, bg }) {
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <svg width={s} height={s} style={{ position: 'absolute', inset: 0 }}>
        <polygon points={`0,${s} 0,0 ${s},${s}`} fill={accent} opacity="0.45" />
      </svg>
      <div style={{
        position: 'absolute', left: f(14), bottom: f(14),
        fontFamily: 'var(--cover-display, "Spectral", Georgia, serif)',
        fontSize: f(28), fontWeight: 500, color: fg,
        lineHeight: 1, letterSpacing: '-0.02em', maxWidth: f(180),
      }}>{title}</div>
      <div style={{
        position: 'absolute', right: f(14), top: f(14), textAlign: 'right',
        fontFamily: 'var(--cover-mono, "JetBrains Mono", monospace)',
        fontSize: f(9), letterSpacing: '.12em', color: fg, opacity: .8,
        textTransform: 'uppercase',
      }}>{artist}<br/><span style={{opacity: .55}}>—</span></div>
    </div>
  );
}

// ── Style: edge — text along left edge, vertical
function EdgeStyle({ s, f, title, artist, fg, accent }) {
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div style={{
        position: 'absolute', top: f(14), bottom: f(14), left: f(18),
        writingMode: 'vertical-rl', transform: 'rotate(180deg)',
        fontFamily: 'var(--cover-display, "Spectral", Georgia, serif)',
        fontSize: f(28), fontWeight: 500, color: fg,
        letterSpacing: '-0.01em', lineHeight: 1,
      }}>{title}</div>
      <div style={{
        position: 'absolute', right: f(14), bottom: f(14), textAlign: 'right',
        fontFamily: 'var(--cover-mono, "JetBrains Mono", monospace)',
        fontSize: f(9), letterSpacing: '.15em', color: accent,
        textTransform: 'uppercase',
      }}>{artist}</div>
      <div style={{
        position: 'absolute', right: f(14), top: f(14),
        width: f(28), height: f(28), borderRadius: '50%', border: `${f(1)}px solid ${accent}`,
      }} />
    </div>
  );
}

// ── Style: ring — concentric arcs
function RingStyle({ s, f, title, artist, fg, accent }) {
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
        {[0.85, 0.65, 0.42, 0.22].map((r, i) => (
          <circle key={i} cx={s/2} cy={s/2} r={(s*r)/2} fill="none"
            stroke={i % 2 === 0 ? accent : fg} strokeWidth={f(0.6)} opacity={0.6 - i*0.1} />
        ))}
        <circle cx={s/2} cy={s/2} r={f(6)} fill={fg} />
      </svg>
      <div style={{
        position: 'absolute', bottom: f(14), left: f(14), right: f(14),
        display: 'flex', justifyContent: 'space-between',
        fontFamily: 'var(--cover-mono, "JetBrains Mono", monospace)',
        fontSize: f(9), letterSpacing: '.15em', color: fg, textTransform: 'uppercase',
      }}>
        <span>{artist}</span><span style={{ color: accent }}>{title}</span>
      </div>
    </div>
  );
}

// ── Style: block — bold modernist type, full bleed title
function BlockStyle({ s, f, title, artist, fg, accent }) {
  return (
    <div style={{ position: 'absolute', inset: 0, padding: f(14), display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <div style={{
        fontFamily: 'var(--cover-mono, "JetBrains Mono", monospace)',
        fontSize: f(9), letterSpacing: '.18em', color: accent, textTransform: 'uppercase',
      }}>{artist} · LP</div>
      <div style={{
        fontFamily: 'var(--cover-display, "Spectral", Georgia, serif)',
        fontSize: f(30), fontWeight: 700, color: fg,
        lineHeight: 0.95, letterSpacing: '-0.025em', textTransform: 'uppercase',
      }}>{title}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div style={{ width: f(40), height: f(2), background: accent }} />
        <div style={{
          fontFamily: 'var(--cover-mono, "JetBrains Mono", monospace)',
          fontSize: f(8.5), letterSpacing: '.12em', color: fg, opacity: .7,
        }}>A | B</div>
      </div>
    </div>
  );
}

// ── Style: ticker — title repeated horizontally like a marquee
function TickerStyle({ s, f, title, artist, fg, accent }) {
  const reps = Array.from({ length: 8 });
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', top: '50%', left: 0, right: 0,
        transform: 'translateY(-50%)',
        fontFamily: 'var(--cover-display, "Spectral", Georgia, serif)',
        fontSize: f(30), fontWeight: 600, color: fg,
        whiteSpace: 'nowrap', textTransform: 'uppercase',
        letterSpacing: '-0.01em',
      }}>
        {reps.map((_, i) => (
          <span key={i} style={{ opacity: i === 0 ? 1 : 0.25 - i * 0.02 }}>{title} · </span>
        ))}
      </div>
      <div style={{
        position: 'absolute', top: f(14), left: f(14),
        fontFamily: 'var(--cover-mono, "JetBrains Mono", monospace)',
        fontSize: f(9), letterSpacing: '.15em', color: accent, textTransform: 'uppercase',
      }}>{artist}</div>
      <div style={{
        position: 'absolute', bottom: f(14), right: f(14),
        fontFamily: 'var(--cover-mono, "JetBrains Mono", monospace)',
        fontSize: f(9), letterSpacing: '.15em', color: accent,
      }}>↻ ↻ ↻</div>
    </div>
  );
}

Object.assign(window, { Cover });
