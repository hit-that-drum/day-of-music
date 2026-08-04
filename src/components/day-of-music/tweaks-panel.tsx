// tweaks-panel.tsx — header-triggered panel to switch theme / typography /
// layout options. Open/close is controlled by the parent (the header button).

"use client";

import { useEffect, useRef } from "react";

import { DomSelectField } from "@/components/day-of-music/dom-select";
import { useT } from "@/lib/day-of-music/i18n";
import {
  AESTHETICS,
  TYPE_PAIRS,
  type AestheticKey,
  type TypeKey,
} from "@/lib/day-of-music/theme";

export type Tweaks = {
  aesthetic: AestheticKey;
  typography: TypeKey;
  /** When on, weeks never span two months: a week that crosses a month
   *  boundary is shown as two separate pages (e.g. "December — Week 5" then
   *  "January — Week 1"). Off keeps the continuous Mon–Sun week. */
  weekSplit: boolean;
};

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
      onClose();
    }
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => window.removeEventListener("pointerdown", onPointerDown, true);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="dom-tweaks-panel" role="dialog" aria-label={t("tweaks.title")} ref={panelRef}>
      <div className="dom-tweaks-panel-hd">
        <span className="dom-tweak-section dom-tweaks-panel-title">{t("tweaks.title")}</span>
        <button className="dom-tweaks-close" onClick={onClose} aria-label={t("tweaks.close")}>
          ✕
        </button>
      </div>

      <div className="dom-tweak-section">{t("tweaks.aesthetic")}</div>
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

      <div className="dom-tweak-section">{t("tweaks.layout")}</div>
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
