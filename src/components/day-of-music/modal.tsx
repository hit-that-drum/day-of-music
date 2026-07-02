// modal.tsx — shared modal chrome: scrim, panel wrapper, and the close button.
// Every overlay modal renders through this so the dialog semantics, dismiss
// behaviour (scrim click / ✕ / Esc), and close-button position stay identical.
// The ✕ floats in a reserved gap above the panel, flush to its right edge, so
// it never overlaps panel content (see .dom-modal in day-of-music.css).

"use client";

import { useEffect, type ReactNode } from "react";

export function Modal({
  label,
  onClose,
  className,
  children,
}: {
  /** Accessible dialog name (aria-label). */
  label: string;
  onClose: () => void;
  /** Extra class(es) on the panel wrapper, for modal-specific layout. */
  className?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="dom-scrim"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      <div
        className={className ? `dom-modal ${className}` : "dom-modal"}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="dom-modal-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
        {children}
      </div>
    </div>
  );
}
