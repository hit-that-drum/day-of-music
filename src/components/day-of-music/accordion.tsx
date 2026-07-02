"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export type AccordionItem = {
  id: string;
  title: ReactNode;
  meta?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
};

export function Accordion({
  items,
  allowMultiple = false,
  className,
}: {
  items: AccordionItem[];
  allowMultiple?: boolean;
  className?: string;
}) {
  const baseId = useId();
  const [openIds, setOpenIds] = useState<string[]>(() =>
    items.filter((item) => item.defaultOpen).map((item) => item.id),
  );

  function toggle(id: string): void {
    setOpenIds((current) => {
      const isOpen = current.includes(id);
      if (allowMultiple) {
        return isOpen
          ? current.filter((openId) => openId !== id)
          : [...current, id];
      }
      return isOpen ? [] : [id];
    });
  }

  return (
    <div className={["dom-accordion", className].filter(Boolean).join(" ")}>
      {items.map((item) => {
        const isOpen = openIds.includes(item.id);
        const triggerId = `${baseId}-${item.id}-trigger`;
        const panelId = `${baseId}-${item.id}-panel`;

        return (
          <section key={item.id} className="dom-accordion-item">
            <button
              id={triggerId}
              type="button"
              className="dom-accordion-trigger"
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => toggle(item.id)}
            >
              <div className="dom-accordion-title">{item.title}</div>
              {item.meta ? (
                <span className="dom-accordion-meta">{item.meta}</span>
              ) : null}
              <ChevronDown
                className="dom-accordion-icon"
                size={18}
                aria-hidden="true"
              />
            </button>
            <div
              id={panelId}
              className="dom-accordion-panel"
              role="region"
              aria-labelledby={triggerId}
              hidden={!isOpen}
            >
              {item.children}
            </div>
          </section>
        );
      })}
    </div>
  );
}
