// tweaks-panel.tsx — header-triggered panel to switch theme / typography /
// layout options. Open/close is controlled by the parent (the header button).

"use client";

import { useEffect, useRef } from "react";

import { DomSelectField } from "@/components/day-of-music/dom-select";
import { useEscapeLayer } from "@/lib/day-of-music/escape-layers";
import { useT } from "@/lib/day-of-music/i18n";
import {
  AESTHETICS,
  TYPE_PAIRS,
  type AestheticKey,
  type TypeKey,
} from "@/lib/day-of-music/appearance";
import type { Tweaks } from "@/lib/day-of-music/tweaks";

/** id of the open panel — the header's Tweaks triggers aria-control it. */
export const TWEAKS_PANEL_ID = "dom-tweaks-panel";

export function TweaksPanel({
  open,
  onClose,
  tweaks,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  tweaks: Tweaks;
  onChange: <K extends keyof Tweaks>(key: K, value: Tweaks[K]) => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  // Set when a click elsewhere closes the panel (see the focus effect below).
  const closedByPointer = useRef(false);
  const t = useT();

  // Dismiss when a pointer-down lands outside the panel. The header's Tweaks
  // button is excluded (it carries data-dom-tweaks-trigger) so its toggle isn't
  // immediately undone — closing while open is left to the button's own onClick.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Element | null;
      if (!target) return;
      if (panelRef.current?.contains(target)) return;
      if (target.closest("[data-dom-tweaks-trigger]")) return;
      closedByPointer.current = true;
      onClose();
    }
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => window.removeEventListener("pointerdown", onPointerDown, true);
  }, [open, onClose]);

  useEscapeLayer(onClose, open);

  // Focus moves into the panel when it opens and back to the Tweaks button
  // when it closes (✕, Escape) — but not when a click elsewhere closed it:
  // that click is on its way to its own target, and moving focus in the
  // middle of it swallowed it (an empty day's "+ log" stopped opening the Add
  // flow). Non-modal, so Tab may still leave the panel.
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const opener = document.activeElement as HTMLElement | null;
    closedByPointer.current = false;
    panel?.focus();
    return () => {
      if (closedByPointer.current) return;
      const active = document.activeElement;
      const lost = !active || active === document.body || panel?.contains(active);
      if (lost && opener?.isConnected) opener.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="dom-tweaks-panel"
      id={TWEAKS_PANEL_ID}
      role="dialog"
      aria-label={t("tweaks.title")}
      ref={panelRef}
      tabIndex={-1}
    >
      <div className="dom-tweaks-panel-hd">
        <span className="dom-section-label dom-tweaks-panel-title">{t("tweaks.title")}</span>
        <button className="dom-tweaks-close" onClick={onClose} aria-label={t("modal.close")}>
          ✕
        </button>
      </div>

      <div className="dom-section-label">{t("tweaks.aesthetic")}</div>
      <DomSelectField
        label={t("tweaks.theme")}
        value={tweaks.aesthetic}
        options={Object.entries(AESTHETICS).map(([k, v]) => ({ value: k, label: v.label }))}
        onChange={(v) => onChange("aesthetic", v as AestheticKey)}
        className="dom-tweak-field"
        labelClassName="dom-tweak-label"
      />
      <DomSelectField
        label={t("tweaks.typography")}
        value={tweaks.typography}
        options={Object.entries(TYPE_PAIRS).map(([k, v]) => ({ value: k, label: v.label }))}
        onChange={(v) => onChange("typography", v as TypeKey)}
        className="dom-tweak-field"
        labelClassName="dom-tweak-label"
      />

      <div className="dom-section-label">{t("tweaks.layout")}</div>
      <div className="dom-tweak-toggle-row">
        <span className="dom-tweak-label">{t("tweaks.splitWeeks")}</span>
        <button
          className="dom-tweak-switch"
          data-on={tweaks.weekSplit ? "1" : "0"}
          onClick={() => onChange("weekSplit", !tweaks.weekSplit)}
        >
          {tweaks.weekSplit ? t("tweaks.on") : t("tweaks.off")}
        </button>
      </div>
    </div>
  );
}
