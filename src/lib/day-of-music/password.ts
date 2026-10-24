// password.ts — single source of truth for the client-side password policy.
// Shared by the signup form and the "change password" flow through
// <PasswordRules> (components/day-of-music/password-rules.tsx); each rule's
// label is the pw.<id> message. This is first-line UX only; the authoritative
// minimum (length 8) is also enforced by Supabase server-side.

export type PasswordRule = {
  /** Also the i18n key suffix: the checklist renders t(`pw.${id}`). */
  id: "length" | "letter" | "number";
  test: (pw: string) => boolean;
};

export const PASSWORD_RULES: PasswordRule[] = [
  { id: "length", test: (pw) => pw.length >= 8 },
  { id: "letter", test: (pw) => /\p{L}/u.test(pw) },
  { id: "number", test: (pw) => /\d/.test(pw) },
];

/** Rules the password fails, in policy order. Empty array means it passes. */
export function passwordIssues(pw: string): PasswordRule[] {
  return PASSWORD_RULES.filter((rule) => !rule.test(pw));
}
