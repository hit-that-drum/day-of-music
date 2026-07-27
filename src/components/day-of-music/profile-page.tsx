// profile-page.tsx — Profile: user-related settings (account + preferences).
// Distinct from "My Logs" (profile-stats.tsx), which is the listening recap.

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

import { useAuth } from "@/components/day-of-music/auth-provider";
import { Button, IconButton } from "@/components/day-of-music/atoms";
import { Modal } from "@/components/day-of-music/modal";
import { DomSelectField } from "@/components/day-of-music/dom-select";
import { PASSWORD_RULES, passwordIssues } from "@/lib/day-of-music/password";
import {
  COUNTRIES,
  DEFAULT_USERNAME,
  useProfile,
  type ProfilePatch,
} from "@/lib/day-of-music/profile";
import { useThemes, type Theme } from "@/lib/day-of-music/themes";

// COUNTRIES is { code, label }; DomSelectField wants { value, label }. Mapped once
// at module scope so the option list is stable across renders.
const COUNTRY_OPTIONS = COUNTRIES.map((c) => ({ value: c.code, label: c.label }));

export function ProfilePage() {
  const { configured, user } = useAuth();
  const { username, country, save, synced } = useProfile();
  const { themes, saveThemes } = useThemes();
  const guest = configured && !user;

  return (
    <div className="dom-profile">
      <div className="dom-week-hd">
        <div className="dom-week-title">
          <span className="dom-eyebrow">프로필 · profile</span>
          <h1>Profile</h1>
        </div>
      </div>

      <div className="dom-profile-settings">
        <section className="dom-settings-card">
          <div className="dom-settings-label">account · 계정</div>
          {user ? (
            <>
              <div className="dom-settings-row">
                <span className="dom-settings-key">Email</span>
                <span className="dom-settings-val">{user.email}</span>
              </div>
              <div className="dom-settings-row">
                <span className="dom-settings-key">Status</span>
                <span className="dom-settings-val">Signed in · synced</span>
              </div>
              <AccountActions email={user.email ?? ""} />
            </>
          ) : guest ? (
            <p className="dom-settings-note">
              You&apos;re browsing as a guest. Sign in to sync your logs and profile
              across devices.
            </p>
          ) : (
            <p className="dom-settings-note">
              Local mode — your settings are saved on this device only.
            </p>
          )}
        </section>

        <section className="dom-settings-card">
          <div className="dom-settings-label">preferences · 환경설정</div>
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
          <div className="dom-settings-label">themes · 테마 레인</div>
          <ThemeManager
            key={themes.map((t) => t.id).join("|")}
            initial={themes}
            synced={synced}
            onSave={saveThemes}
          />
        </section>
      </div>
    </div>
  );
}

// Change-password + delete-account controls for a signed-in user. Password
// change is session-based (no re-auth). Deletion is irreversible, so it routes
// through a confirm modal that requires typing the exact email.
function AccountActions({ email }: { email: string }) {
  const { updatePassword, deleteAccount } = useAuth();
  const router = useRouter();

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
    toast.success("비밀번호가 변경되었어요.");
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
    toast.success("계정이 삭제되었습니다.");
    router.replace("/");
  }

  return (
    <>
      <div className="dom-settings-actions">
        <Button variant="ghost" onClick={() => setPwOpen((v) => !v)} aria-expanded={pwOpen}>
          {pwOpen ? "Cancel" : "Change password · 비밀번호 변경"}
        </Button>
        <Button variant="danger-ghost" onClick={() => setConfirmOpen(true)}>
          Delete account · 회원 탈퇴
        </Button>
      </div>

      {pwOpen && (
        <form className="dom-signin-form" onSubmit={handleChangePassword} style={{ marginTop: 8 }}>
          <input
            className="dom-input"
            type="password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            aria-describedby="dom-change-pw-rules"
            required
          />
          <ul className="dom-pw-rules" id="dom-change-pw-rules" aria-label="Password requirements">
            {PASSWORD_RULES.map((rule) => {
              const met = rule.test(password);
              return (
                <li key={rule.id} className="dom-pw-rule" data-met={met ? "1" : "0"}>
                  <span className="dom-pw-rule-mark" aria-hidden="true">
                    {met ? "✓" : "○"}
                  </span>
                  <span>{rule.label}</span>
                  <span className="dom-visually-hidden">{met ? " (met)" : " (not met)"}</span>
                </li>
              );
            })}
          </ul>
          <Button type="submit" disabled={pwInvalid || pwBusy}>
            {pwBusy ? "One moment…" : "Update password"}
          </Button>
        </form>
      )}

      {confirmOpen && (
        <Modal
          label="Delete account confirmation"
          className="dom-danger-modal-wrap"
          onClose={() => {
            if (!delBusy) setConfirmOpen(false);
          }}
        >
          <div className="dom-danger-modal">
            <h2 className="dom-danger-modal-title">회원 탈퇴 · Delete account</h2>
            <p className="dom-danger-modal-body">
              This permanently deletes your account and all of its journal entries and
              shared cards. This <strong>cannot be undone</strong>. Type{" "}
              <strong>{email}</strong> to confirm.
            </p>
            <input
              className="dom-input"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={email}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              aria-label="Type your email to confirm deletion"
            />
            <div className="dom-settings-actions" style={{ marginTop: 4 }}>
              <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={delBusy}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleDelete} disabled={!confirmed || delBusy}>
                {delBusy ? "Deleting…" : "Delete forever"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
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
  onSave: (patch: ProfilePatch) => void;
}) {
  const [name, setName] = useState(initialName);
  const [country, setCountry] = useState(initialCountry);
  const handle = name.trim() || DEFAULT_USERNAME;
  const dirty = name.trim() !== initialName.trim() || country !== initialCountry;

  return (
    <>
      <label className="dom-edit-field">
        <span className="dom-edit-label">Username</span>
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
          label="Store country · 스토어 국가"
          ariaLabel="Store country"
          className="dom-store-country-field"
          labelClassName="dom-edit-label"
          value={country}
          options={COUNTRY_OPTIONS}
          onChange={setCountry}
          searchable
          searchPlaceholder="Search country · 국가 검색"
          variant="underline"
          size="medium"
        />
        <Button disabled={!dirty} onClick={() => onSave({ username: name.trim(), country })}>
          Save changes
        </Button>
      </div>
      <p className="dom-settings-note">
        Shown as <strong>@{handle}</strong> on shared images. Music search checks the{" "}
        <strong>{country}</strong> store first, then the others.{" "}
        {synced ? "Synced to your account." : "Saved on this device."}
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
  onSave: (themes: Theme[]) => void;
}) {
  const [list, setList] = useState<Theme[]>(initial);
  // `initial` is fixed for a given mount (the parent re-keys on theme-id change),
  // so memoize against `list` to avoid stringifying both lists every render.
  const dirty = useMemo(
    () => JSON.stringify(list) !== JSON.stringify(initial),
    [list, initial],
  );

  const update = (i: number, patch: Partial<Theme>) =>
    setList((l) => l.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
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
    setList((l) => [...l, { id: crypto.randomUUID(), name: "New theme", emoji: "🎵" }]);

  return (
    <>
      {list.map((t, i) => (
        <div key={t.id} className="dom-theme-editor-row">
          <input
            className="dom-input dom-theme-emoji"
            value={t.emoji}
            maxLength={2}
            onChange={(e) => update(i, { emoji: e.target.value })}
            aria-label="Theme emoji"
          />
          <input
            className="dom-input"
            value={t.name}
            maxLength={24}
            onChange={(e) => update(i, { name: e.target.value })}
            aria-label="Theme name"
          />
          <IconButton
            icon={ArrowUp}
            onClick={() => move(i, -1)}
            disabled={i === 0}
            aria-label="Move up"
          />
          <IconButton
            icon={ArrowDown}
            onClick={() => move(i, 1)}
            disabled={i === list.length - 1}
            aria-label="Move down"
          />
          <IconButton
            icon={Trash2}
            onClick={() => remove(i)}
            disabled={list.length <= 1}
            aria-label="Delete theme"
          />
        </div>
      ))}
      <div className="dom-settings-actions">
        <Button className="dom-btn-with-icon" variant="ghost" onClick={add}>
          <Plus size={16} strokeWidth={2} aria-hidden="true" />
          Add theme
        </Button>
        <Button disabled={!dirty} onClick={() => onSave(list)}>
          Save themes
        </Button>
      </div>
      <p className="dom-settings-note">
        Each theme is its own daily lane. {synced ? "Synced to your account." : "Saved on this device."}{" "}
        삭제해도 그 테마의 기록은 서버에서 지워지지 않고 숨겨집니다.
      </p>
    </>
  );
}
