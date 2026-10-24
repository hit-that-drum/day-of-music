// profile-page.tsx — Profile: user-related settings (account + preferences).
// Distinct from "My Logs" (profile-stats.tsx), which is the listening recap.

"use client";

import { useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

import { useAuth, type AuthResult } from "@/lib/day-of-music/auth-provider";
import { Button, IconButton } from "@/components/day-of-music/atoms";
import { Modal } from "@/components/day-of-music/modal";
import { DomSelectField } from "@/components/day-of-music/dom-select";
import { passwordIssues } from "@/lib/day-of-music/password";
import { PasswordRules } from "@/components/day-of-music/password-rules";
import { GoogleIcon, KakaoIcon } from "@/components/day-of-music/brand-icons";
import { SharedLinksSummaryCard } from "@/components/day-of-music/shared-links-manager";
import {
  countriesForLocale,
  DEFAULT_USERNAME,
  displayHandle,
  useProfile,
  type ProfilePatch,
} from "@/lib/day-of-music/profile";
import { useThemes, type Theme } from "@/lib/day-of-music/themes";
import { useLanguage, useT } from "@/lib/day-of-music/i18n";

// Display labels for the OAuth providers we support (icons live in brand-icons).
const PROVIDER_LABELS: Record<string, string> = {
  google: "Google",
  kakao: "Kakao",
};

export function ProfilePage() {
  const { configured, user } = useAuth();
  const { username, country, save, synced } = useProfile();
  const { themes, saveThemes } = useThemes();
  const t = useT();
  const guest = configured && !user;

  // Which provider(s) this account signed in with — drives the "signed in with"
  // row and whether there's a password to change.
  const providers = (user?.identities ?? []).map((i) => i.provider);
  const socialProviders = providers.filter((p) => p !== "email");
  // Only email/password accounts can change a password. If we can't tell (no
  // identities), default to showing it so real email users aren't blocked.
  const canChangePassword =
    providers.length === 0 || providers.includes("email");

  return (
    <div className="dom-profile">
      <div className="dom-week-hd">
        <div className="dom-week-title">
          <span className="dom-eyebrow">{t("profile.kicker")}</span>
          <h1>{t("profile.title")}</h1>
        </div>
      </div>

      <div className="dom-profile-settings">
        <section className="dom-settings-card">
          <div className="dom-settings-label">{t("profile.section.account")}</div>
          {user ? (
            <>
              <div className="dom-settings-row">
                <span className="dom-settings-key">{t("profile.email")}</span>
                <span className="dom-settings-val">{user.email}</span>
              </div>
              {socialProviders.length > 0 && (
                <div className="dom-settings-row">
                  <span className="dom-settings-key">{t("profile.signInRow")}</span>
                  <span className="dom-settings-val dom-provider-val">
                    {socialProviders.map((p) => (
                      <span key={p} className="dom-provider-badge">
                        {p === "google" ? (
                          <GoogleIcon />
                        ) : p === "kakao" ? (
                          <KakaoIcon />
                        ) : null}
                        {PROVIDER_LABELS[p] ?? p}
                      </span>
                    ))}
                  </span>
                </div>
              )}
              <div className="dom-settings-row">
                <span className="dom-settings-key">{t("profile.status")}</span>
                <span className="dom-settings-val">{t("profile.statusSignedIn")}</span>
              </div>
              <AccountActions
                email={user.email ?? ""}
                canChangePassword={canChangePassword}
              />
            </>
          ) : guest ? (
            <p className="dom-settings-note">{t("profile.guestNote")}</p>
          ) : (
            <p className="dom-settings-note">{t("profile.localNote")}</p>
          )}
        </section>

        <section className="dom-settings-card">
          <div className="dom-settings-label">{t("profile.section.preferences")}</div>
          {/* Re-seed the form whenever the canonical values change (auth load,
              after save, or device switch). */}
          <SettingsForm
            key={`${username}|${country}`}
            initialName={username}
            initialCountry={country}
            synced={synced}
            onSave={save}
          />
        </section>

        <section className="dom-settings-card">
          <div className="dom-settings-label">{t("profile.section.themes")}</div>
          <ThemeManager
            key={themes.map((theme) => theme.id).join("|")}
            initial={themes}
            synced={synced}
            onSave={saveThemes}
          />
        </section>

        {user && <SharedLinksSummaryCard userId={user.id} />}
      </div>
    </div>
  );
}

// Change-password + delete-account controls for a signed-in user. Password
// change is session-based (no re-auth). Deletion is irreversible, so it routes
// through a confirm modal that requires typing the exact email.
function AccountActions({
  email,
  canChangePassword,
}: {
  email: string;
  canChangePassword: boolean;
}) {
  const { updatePassword, deleteAccount } = useAuth();
  const router = useRouter();
  const t = useT();
  const deleteTitleId = useId();

  const [pwOpen, setPwOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const pwInvalid = passwordIssues(password).length > 0;

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [delBusy, setDelBusy] = useState(false);
  const confirmed = confirmText.trim() === email;

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pwInvalid || pwBusy) return;
    setPwBusy(true);
    const { error } = await updatePassword(password);
    setPwBusy(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success(t("profile.pw.changed"));
    setPassword("");
    setPwOpen(false);
  }

  async function handleDelete() {
    if (!confirmed || delBusy) return;
    setDelBusy(true);
    const { error } = await deleteAccount();
    if (error) {
      setDelBusy(false);
      toast.error(error);
      return;
    }
    toast.success(t("profile.delete.done"));
    router.replace("/");
  }

  return (
    <>
      <div className="dom-settings-actions">
        {canChangePassword && (
          <Button
            variant="ghost"
            onClick={() => setPwOpen((v) => !v)}
            aria-expanded={pwOpen}
          >
            {pwOpen ? t("action.cancel") : t("profile.changePassword")}
          </Button>
        )}
        <Button variant="danger-ghost" onClick={() => setConfirmOpen(true)}>
          {t("profile.deleteAccount")}
        </Button>
      </div>

      {canChangePassword && pwOpen && (
        <form
          className="dom-signin-form"
          onSubmit={handleChangePassword}
          style={{ marginTop: 8 }}
        >
          <input
            className="dom-input"
            type="password"
            placeholder={t("profile.pw.placeholder")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            aria-describedby="dom-change-pw-rules"
            required
          />
          <PasswordRules password={password} id="dom-change-pw-rules" />
          <Button type="submit" disabled={pwInvalid || pwBusy}>
            {pwBusy ? t("auth.oneMoment") : t("profile.pw.submit")}
          </Button>
        </form>
      )}

      {confirmOpen && (
        <Modal
          labelledBy={deleteTitleId}
          width={420}
          onClose={() => {
            if (!delBusy) setConfirmOpen(false);
          }}
        >
          <div className="dom-danger-modal">
            <h2 className="dom-danger-modal-title" id={deleteTitleId}>
              {t("profile.deleteAccount")}
            </h2>
            <p className="dom-danger-modal-body">
              {t("profile.delete.body")} <strong>{t("profile.delete.irreversible")}</strong>{" "}
              <EmphasizedEmail template={t("profile.delete.typeEmail")} email={email} />
            </p>
            <input
              className="dom-input"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={email}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              aria-label={t("profile.delete.inputAria")}
            />
            <div className="dom-settings-actions" style={{ marginTop: 4 }}>
              <Button
                variant="ghost"
                onClick={() => setConfirmOpen(false)}
                disabled={delBusy}
              >
                {t("action.cancel")}
              </Button>
              <Button
                variant="danger"
                onClick={handleDelete}
                disabled={!confirmed || delBusy}
              >
                {delBusy ? t("action.deleting") : t("profile.delete.submit")}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

// A translated sentence with its {email} token in bold. Split on the token
// instead of interpolating, so the markup survives each language's word order.
function EmphasizedEmail({ template, email }: { template: string; email: string }) {
  const [before = "", after = ""] = template.split("{email}");
  return (
    <>
      {before}
      <strong>{email}</strong>
      {after}
    </>
  );
}

function SettingsForm({
  initialName,
  initialCountry,
  synced,
  onSave,
}: {
  initialName: string;
  initialCountry: string;
  synced: boolean;
  onSave: (patch: ProfilePatch) => Promise<AuthResult>;
}) {
  const [name, setName] = useState(initialName);
  const [country, setCountry] = useState(initialCountry);
  const t = useT();

  // A save that lands re-keys this form with the new values; a rejected one
  // leaves the edits in place to try again.
  async function save() {
    const { error } = await onSave({ username: name.trim(), country });
    if (error) toast.error(t("toast.saveFailed"), { description: error });
  }
  const { locale } = useLanguage();
  // Country names + collation follow the current UI language. { code, label } →
  // { value, label } for DomSelectField; rebuilt only when the locale changes.
  const countryOptions = useMemo(
    () => countriesForLocale(locale).map((c) => ({ value: c.code, label: c.label })),
    [locale],
  );
  const handle = displayHandle(name);
  const dirty =
    name.trim() !== initialName.trim() || country !== initialCountry;

  return (
    <>
      <label className="dom-edit-field">
        <span className="dom-edit-label">{t("profile.username")}</span>
        <input
          className="dom-input"
          value={name}
          maxLength={30}
          onChange={(e) => setName(e.target.value)}
          placeholder={DEFAULT_USERNAME}
        />
      </label>
      <div className="dom-store-country-save-row">
        <DomSelectField
          label={t("profile.storeCountry")}
          ariaLabel={t("profile.storeCountry")}
          className="dom-store-country-field"
          labelClassName="dom-edit-label"
          value={country}
          options={countryOptions}
          onChange={setCountry}
          searchable
          searchPlaceholder={t("profile.searchCountry")}
          variant="underline"
        />
        <Button
          disabled={!dirty}
          onClick={() => void save()}
        >
          {t("profile.save")}
        </Button>
      </div>
      <p className="dom-settings-note">
        {t("profile.settingsNote", { handle, country })}
        {synced ? t("profile.syncedNote") : t("profile.localSaveNote")}
      </p>
    </>
  );
}

function ThemeManager({
  initial,
  synced,
  onSave,
}: {
  initial: Theme[];
  synced: boolean;
  onSave: (themes: Theme[]) => Promise<AuthResult>;
}) {
  const [list, setList] = useState<Theme[]>(initial);
  const t = useT();

  // As in SettingsForm: a rejected save keeps the edited list.
  async function save() {
    const { error } = await onSave(list);
    if (error) toast.error(t("toast.saveFailed"), { description: error });
  }
  // `initial` is fixed for a given mount (the parent re-keys on theme-id change),
  // so memoize against `list` to avoid stringifying both lists every render.
  const dirty = useMemo(
    () => JSON.stringify(list) !== JSON.stringify(initial),
    [list, initial],
  );

  const update = (i: number, patch: Partial<Theme>) =>
    setList((l) => l.map((theme, idx) => (idx === i ? { ...theme, ...patch } : theme)));
  const move = (i: number, dir: 1 | -1) =>
    setList((l) => {
      const j = i + dir;
      if (j < 0 || j >= l.length) return l;
      const copy = [...l];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  const remove = (i: number) =>
    setList((l) => (l.length <= 1 ? l : l.filter((_, idx) => idx !== i)));
  const add = () =>
    setList((l) => [
      ...l,
      { id: crypto.randomUUID(), name: t("profile.themes.newName"), emoji: "🎵" },
    ]);

  return (
    <>
      {list.map((theme, i) => (
        <div key={theme.id} className="dom-theme-editor-row">
          <input
            className="dom-input dom-theme-emoji"
            value={theme.emoji}
            maxLength={2}
            onChange={(e) => update(i, { emoji: e.target.value })}
            aria-label={t("aria.themeEmoji")}
          />
          <input
            className="dom-input"
            value={theme.name}
            maxLength={24}
            onChange={(e) => update(i, { name: e.target.value })}
            aria-label={t("aria.themeName")}
          />
          <IconButton
            icon={ArrowUp}
            onClick={() => move(i, -1)}
            disabled={i === 0}
            aria-label={t("aria.moveUp")}
          />
          <IconButton
            icon={ArrowDown}
            onClick={() => move(i, 1)}
            disabled={i === list.length - 1}
            aria-label={t("aria.moveDown")}
          />
          <IconButton
            icon={Trash2}
            onClick={() => remove(i)}
            disabled={list.length <= 1}
            aria-label={t("aria.deleteTheme")}
          />
        </div>
      ))}
      <div className="dom-settings-actions">
        <Button className="dom-btn-with-icon" variant="ghost" onClick={add}>
          <Plus size={16} strokeWidth={2} aria-hidden="true" />
          {t("profile.themes.add")}
        </Button>
        <Button disabled={!dirty} onClick={() => void save()}>
          {t("profile.themes.save")}
        </Button>
      </div>
      <p className="dom-settings-note">
        {t("profile.themes.note", {
          syncNote: synced ? t("profile.syncedNote") : t("profile.localSaveNote"),
        })}
      </p>
    </>
  );
}
