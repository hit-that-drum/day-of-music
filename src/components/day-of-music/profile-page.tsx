// profile-page.tsx — Profile: user-related settings (account + preferences).
// Distinct from "My Logs" (profile-stats.tsx), which is the listening recap.

"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

import { useAuth } from "@/components/day-of-music/auth-provider";
import { Button, IconButton } from "@/components/day-of-music/atoms";
import { DomSelectField } from "@/components/day-of-music/dom-select";
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
