// tweaks-panel.tsx — floating panel to switch theme / typography / layout options.

"use client";

import { useState } from "react";

import {
  AESTHETICS,
  TYPE_PAIRS,
  type AestheticKey,
  type TypeKey,
} from "@/lib/day-of-music/theme";

export type Tweaks = {
  aesthetic: AestheticKey;
  typography: TypeKey;
  showJournal: boolean;
};

export function TweaksPanel({
  tweaks,
  onChange,
}: {
  tweaks: Tweaks;
  onChange: <K extends keyof Tweaks>(key: K, value: Tweaks[K]) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="dom-tweaks">
      {open && (
        <div className="dom-tweaks-panel">
          <div className="dom-tweak-section">Aesthetic</div>
          <Select
            label="Theme"
            value={tweaks.aesthetic}
            options={Object.entries(AESTHETICS).map(([k, v]) => ({ value: k, label: v.label }))}
            onChange={(v) => onChange("aesthetic", v as AestheticKey)}
          />
          <Select
            label="Typography"
            value={tweaks.typography}
            options={Object.entries(TYPE_PAIRS).map(([k, v]) => ({ value: k, label: v.label }))}
            onChange={(v) => onChange("typography", v as TypeKey)}
          />

          <div className="dom-tweak-section">Layout</div>
          <div className="dom-tweak-toggle-row">
            <span className="dom-tweak-label">Show journal rail</span>
            <button
              className="dom-tweak-switch"
              data-on={tweaks.showJournal ? "1" : "0"}
              onClick={() => onChange("showJournal", !tweaks.showJournal)}
            >
              {tweaks.showJournal ? "On" : "Off"}
            </button>
          </div>
        </div>
      )}
      <button className="dom-tweaks-toggle" onClick={() => setOpen((o) => !o)}>
        {open ? "Close" : "Tweaks"}
      </button>
    </div>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="dom-tweak-field">
      <span className="dom-tweak-label">{label}</span>
      <select
        className="dom-tweak-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
