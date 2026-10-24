// escape-layers.ts — Escape closes the innermost open layer, and only that.
// Overlays stack: the public-link confirm inside a share modal, the poster zoom
// over its card, the day picker inside Day Detail, a dropdown inside the Tweaks
// panel. Each used to listen for Escape on window itself — bubble or capture
// phase, some with stopPropagation to beat the others — and a nested confirm's
// Escape also closed the modal beneath it. Now every layer joins one stack
// while it's open, and a single listener hands Escape to the newest.

import { useEffect, useEffectEvent } from "react";

const layers: { onEscape: () => void }[] = [];

function onKeyDown(e: KeyboardEvent) {
  if (e.key !== "Escape") return;
  const top = layers[layers.length - 1];
  if (!top) return;
  // Capture phase, then stopped: no other handler (the page's own shortcuts,
  // a component's key handler) acts on an Escape a layer took.
  e.stopPropagation();
  top.onEscape();
}

/** While `enabled`, make this component an Escape layer: Escape calls
 *  `onEscape` unless a layer opened after it is still open. Layers stack in
 *  the order their effects run, so a nested layer must open after its parent
 *  (it does today: each opens on its own user action). */
export function useEscapeLayer(onEscape: () => void, enabled = true): void {
  const fireEscape = useEffectEvent(onEscape);

  useEffect(() => {
    if (!enabled) return;
    const layer = { onEscape: () => fireEscape() };
    if (layers.length === 0) window.addEventListener("keydown", onKeyDown, true);
    layers.push(layer);
    return () => {
      layers.splice(layers.indexOf(layer), 1);
      if (layers.length === 0) window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [enabled]);
}
