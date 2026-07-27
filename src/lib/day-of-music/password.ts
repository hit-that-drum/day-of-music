// password.ts — single source of truth for the client-side password policy.
// Shared by the signup form and the "change password" flow so both show the
// same live checklist. This is first-line UX only; the authoritative minimum
// (length 8) is also enforced by Supabase server-side.

export type PasswordRule = { id: string; label: string; test: (pw: string) => boolean };

export const PASSWORD_RULES: PasswordRule[] = [
  { id: "length", label: "At least 8 characters", test: (pw) => pw.length >= 8 },
  { id: "letter", label: "Contains a letter", test: (pw) => /\p{L}/u.test(pw) },
  { id: "number", label: "Contains a number", test: (pw) => /\d/.test(pw) },
];

/** Rules the password fails, in policy order. Empty array means it passes. */
export function passwordIssues(pw: string): PasswordRule[] {
  return PASSWORD_RULES.filter((rule) => !rule.test(pw));
}
