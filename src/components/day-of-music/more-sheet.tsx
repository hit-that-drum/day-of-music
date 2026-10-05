// more-sheet.tsx — the phone "⋯ More" overflow sheet: language strip, account
// (Sign out / Sign in + Sign up) and legal links. Renders through the shared
// Modal so scrim / ✕ / Esc semantics stay identical to every other overlay.

"use client";

import Link from "next/link";
import { useEffect, useRef, type KeyboardEvent } from "react";

import { Button, buttonClass } from "@/components/day-of-music/atoms";
import { Modal } from "@/components/day-of-music/modal";
import { LOCALES, useLanguage, useT } from "@/lib/day-of-music/i18n";

export function MoreSheet({
  onClose,
  account,
  showAuthLinks,
}: {
  onClose: () => void;
  account: { email: string; onSignOut: () => void } | null;
  showAuthLinks: boolean;
}) {
  const t = useT();
  const { locale, setLanguage } = useLanguage();
  // The checked radio — the group's single Tab stop and the initial focus.
  const checkedRef = useRef<HTMLButtonElement>(null);
  const groupRef = useRef<HTMLDivElement>(null);

  // Initial focus + return focus to the ⋯ trigger on close (ref read inside an
  // effect — allowed by react-hooks/refs).
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    checkedRef.current?.focus();
    return () => prev?.focus();
  }, []);

  // APG radiogroup keyboard contract: roving tabindex (only the checked radio
  // is a Tab stop); ←/→ Home/End move focus AND select, wrapping at the ends.
  function onGroupKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const cur = LOCALES.findIndex((l) => l.code === locale);
    let next: number;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      next = (cur + 1) % LOCALES.length;
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      next = (cur - 1 + LOCALES.length) % LOCALES.length;
    } else if (e.key === "Home") {
      next = 0;
    } else if (e.key === "End") {
      next = LOCALES.length - 1;
    } else {
      return;
    }
    e.preventDefault();
    setLanguage(LOCALES[next].code);
    groupRef.current
      ?.querySelectorAll<HTMLButtonElement>('[role="radio"]')
      [next]?.focus();
  }

  return (
    <Modal
      label={t("menu.title")}
      onClose={onClose}
      className="dom-sheet dom-more-sheet"
    >
      <div className="dom-sheet-body">
        <div className="dom-tweak-section">{t("lang.label")}</div>
        <div
          className="dom-menu-langs"
          role="radiogroup"
          aria-label={t("lang.label")}
          ref={groupRef}
          onKeyDown={onGroupKeyDown}
        >
          {LOCALES.map((l) => {
            const checked = locale === l.code;
            return (
              <button
                key={l.code}
                ref={checked ? checkedRef : undefined}
                type="button"
                role="radio"
                aria-checked={checked}
                tabIndex={checked ? 0 : -1}
                className="dom-menu-lang"
                data-active={checked ? "1" : "0"}
                title={`${l.native} · ${l.label}`}
                onClick={() => setLanguage(l.code)}
              >
                {l.native}
              </button>
            );
          })}
        </div>

        <div className="dom-tweak-section">{t("profile.section.account")}</div>
        {account ? (
          <div className="dom-menu-row">
            <span className="dom-account-email" title={account.email}>
              {account.email}
            </span>
            <Button
              variant="ghost"
              onClick={() => {
                account.onSignOut();
                onClose();
              }}
            >
              {t("actions.signOut")}
            </Button>
          </div>
        ) : showAuthLinks ? (
          <div className="dom-menu-2up">
            <Link href="/signin" className={buttonClass("ghost")}>
              {t("actions.signIn")}
            </Link>
            <Link href="/signup" className={buttonClass()}>
              {t("actions.signUp")}
            </Link>
          </div>
        ) : null}

        <nav className="dom-menu-legal" aria-label={t("home.legalAria")}>
          <Link href="/terms">{t("legal.termsLink")}</Link>
          <span aria-hidden="true"> · </span>
          <Link href="/privacy">{t("legal.privacyLink")}</Link>
        </nav>
      </div>
    </Modal>
  );
}
