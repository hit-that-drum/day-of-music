// legal-shell.tsx — the frame both legal documents share: the brand top bar,
// the document heading (eyebrow, title, effective date) and the closing
// footer. Each page keeps its own sections, top-bar links and closing lines.

import Link from "next/link";
import type { ReactNode } from "react";

import { BrandMark } from "@/components/day-of-music/atoms";

export function LegalShell({
  eyebrow,
  title,
  effectiveDate,
  nav,
  footer,
  children,
}: {
  eyebrow: string;
  title: string;
  effectiveDate: string;
  /** The top bar's right-hand side. */
  nav: ReactNode;
  /** The document's closing lines. */
  footer: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="dom-stage">
      <div className="dom-root dom-legal-root" data-grid="1">
        <header className="dom-topbar dom-legal-topbar">
          <Link
            href="/"
            className="dom-brand"
            aria-label="Day of Music 홈으로 이동"
          >
            <BrandMark />
            <span className="dom-brand-name">Day of Music</span>
            <span className="dom-brand-ko">하루의 음악</span>
          </Link>
          {nav}
        </header>

        <main className="dom-legal">
          <div className="dom-legal-heading">
            <p className="dom-eyebrow">{eyebrow}</p>
            <h1>{title}</h1>
            <p>시행일 {effectiveDate}</p>
          </div>

          {children}

          <footer className="dom-legal-document-footer">{footer}</footer>
        </main>
      </div>
    </div>
  );
}
