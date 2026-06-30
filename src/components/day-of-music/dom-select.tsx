// dom-select.tsx — a designed replacement for the native <select>. Renders an
// ARIA listbox (combobox pattern): a trigger button showing the current value
// and a dropdown panel of options. Themed via the .dom-* CSS variables so it
// matches the editorial look instead of the OS dropdown chrome.
//
// Pass `searchable` for long option lists (e.g. the country picker): the open
// panel then shows a filter input that narrows the list as you type.

"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export type DomSelectOption = { value: string; label: string };

export type DomSelectProps = {
  value: string;
  options: DomSelectOption[];
  onChange: (value: string) => void;
  ariaLabel?: string;
  placeholder?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
};

export function DomSelectField({
  label,
  className,
  labelClassName,
  variant = "default",
  size = "default",
  ariaLabel,
  ...selectProps
}: DomSelectProps & {
  label: string;
  className?: string;
  labelClassName?: string;
  variant?: "default" | "underline";
  size?: "default" | "medium" | "large";
}) {
  return (
    <div className={cn("dom-select-field", className)} data-variant={variant} data-size={size}>
      <span className={cn("dom-select-field-label", labelClassName)}>{label}</span>
      <DomSelect ariaLabel={ariaLabel ?? label} {...selectProps} />
    </div>
  );
}

export function DomSelect({
  value,
  options,
  onChange,
  ariaLabel,
  placeholder = "Select…",
  searchable = false,
  searchPlaceholder = "Search…",
}: DomSelectProps) {
  const [open, setOpen] = useState(false);
  // Index of the keyboard-highlighted option — into the *filtered* list below.
  const [active, setActive] = useState(-1);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const baseId = useId();

  const selected = options.find((o) => o.value === value) ?? null;
  const optionId = (i: number) => `${baseId}-opt-${i}`;
  const listId = `${baseId}-list`;

  const filtered = useMemo(() => {
    if (!searchable || !query.trim()) return options;
    const q = query.trim().toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [searchable, query, options]);

  // Close on a pointer-down outside the whole control. The trigger and search
  // input both live inside rootRef, so interacting with them isn't caught here.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => window.removeEventListener("pointerdown", onPointerDown, true);
  }, [open]);

  // On open, the panel is committed to the DOM, so the input exists and can be
  // focused directly — let the user type straight away.
  useEffect(() => {
    if (open && searchable) searchRef.current?.focus();
  }, [open, searchable]);

  // Keep the highlighted option scrolled into view (lists can be long).
  useEffect(() => {
    if (!open || active < 0) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  function openSelect() {
    setQuery("");
    setActive(options.findIndex((o) => o.value === value));
    setOpen(true);
  }

  function close(focusTrigger = false) {
    setOpen(false);
    setQuery("");
    if (focusTrigger) triggerRef.current?.focus();
  }

  function commit(i: number, focusTrigger = false) {
    const o = filtered[i];
    if (o) onChange(o.value);
    close(focusTrigger);
  }

  // Shared arrow/Enter/Escape navigation, used by both the trigger (non-search)
  // and the search input. Space is intentionally left out so it can be typed.
  function navKeys(e: React.KeyboardEvent) {
    switch (e.key) {
      case "Escape":
        e.preventDefault();
        close(true);
        return true;
      case "ArrowDown":
        e.preventDefault();
        setActive((i) => Math.min(filtered.length - 1, i + 1));
        return true;
      case "ArrowUp":
        e.preventDefault();
        setActive((i) => Math.max(0, i - 1));
        return true;
      case "Home":
        e.preventDefault();
        setActive(0);
        return true;
      case "End":
        e.preventDefault();
        setActive(filtered.length - 1);
        return true;
      case "Enter":
        e.preventDefault();
        if (active >= 0 && active < filtered.length) commit(active, true);
        return true;
    }
    return false;
  }

  function onTriggerKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(e.key)) {
        e.preventDefault();
        openSelect();
      }
      return;
    }
    // Open + not searchable: focus stays on the trigger, so it drives nav.
    // (When searchable, focus moves to the search input which handles keys.)
    if (e.key === " ") {
      e.preventDefault();
      if (active >= 0 && active < filtered.length) commit(active, true);
      return;
    }
    navKeys(e);
  }

  return (
    <div className="dom-select" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="dom-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        aria-activedescendant={open && !searchable && active >= 0 ? optionId(active) : undefined}
        data-open={open ? "1" : "0"}
        onClick={() => (open ? close() : openSelect())}
        onKeyDown={onTriggerKeyDown}
      >
        <span className="dom-select-value" data-empty={selected ? "0" : "1"}>
          {selected ? selected.label : placeholder}
        </span>
        <span className="dom-select-caret" aria-hidden>
          ▾
        </span>
      </button>

      {open && (
        <div className="dom-select-panel">
          {searchable && (
            <div className="dom-select-search">
              <input
                ref={searchRef}
                type="text"
                className="dom-select-search-input"
                role="combobox"
                aria-expanded="true"
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={active >= 0 ? optionId(active) : undefined}
                aria-label={ariaLabel ? `Search ${ariaLabel}` : "Search"}
                placeholder={searchPlaceholder}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0); // highlight the first match as the user types
                }}
                onKeyDown={navKeys}
              />
            </div>
          )}

          <ul className="dom-select-list" role="listbox" aria-label={ariaLabel} id={listId} ref={listRef}>
            {filtered.length === 0 ? (
              <li className="dom-select-empty" role="presentation">
                No matches
              </li>
            ) : (
              filtered.map((o, i) => (
                <li
                  key={o.value}
                  id={optionId(i)}
                  role="option"
                  aria-selected={o.value === value}
                  data-index={i}
                  data-active={i === active ? "1" : "0"}
                  data-selected={o.value === value ? "1" : "0"}
                  className="dom-select-option"
                  // Mouse hover drives the highlight so pointer + keyboard agree.
                  onMouseEnter={() => setActive(i)}
                  // pointerdown (not click) so the outside-close listener — which
                  // also fires on pointerdown — never beats the selection.
                  onPointerDown={(e) => {
                    e.preventDefault();
                    commit(i);
                  }}
                >
                  <span className="dom-select-check" aria-hidden>
                    {o.value === value ? "✓" : ""}
                  </span>
                  <span className="dom-select-option-label">{o.label}</span>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
