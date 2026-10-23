// password-rules.tsx — the live password checklist under a new-password field
// (sign-up, and Profile's change password). The field points at it with
// aria-describedby, so the caller picks the id.

"use client";

import { useT } from "@/lib/day-of-music/i18n";
import { PASSWORD_RULES } from "@/lib/day-of-music/password";

export function PasswordRules({ password, id }: { password: string; id: string }) {
  const t = useT();
  return (
    <ul className="dom-pw-rules" id={id} aria-label={t("auth.pwRulesAria")}>
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(password);
        return (
          <li key={rule.id} className="dom-pw-rule" data-met={met ? "1" : "0"}>
            <span className="dom-pw-rule-mark" aria-hidden="true">
              {met ? "✓" : "○"}
            </span>
            <span>{t(`pw.${rule.id}`)}</span>
            <span className="dom-visually-hidden">
              {met ? ` ${t("auth.met")}` : ` ${t("auth.notMet")}`}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
