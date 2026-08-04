// profile-page.tsx — Profile: user-related settings (account + preferences).
// Distinct from "My Logs" (profile-stats.tsx), which is the listening recap.

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

import { useAuth } from "@/components/day-of-music/auth-provider";
import {
  Button,
  IconButton,
  buttonClass,
} from "@/components/day-of-music/atoms";
import { Modal } from "@/components/day-of-music/modal";
import { DomSelectField } from "@/components/day-of-music/dom-select";
import { PASSWORD_RULES, passwordIssues } from "@/lib/day-of-music/password";
import { GoogleIcon, KakaoIcon } from "@/components/day-of-music/brand-icons";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  countriesForLocale,
  DEFAULT_USERNAME,
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
            key={themes.map((t) => t.id).join("|")}
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
        {canChangePassword && (
          <Button
            variant="ghost"
            onClick={() => setPwOpen((v) => !v)}
            aria-expanded={pwOpen}
          >
            {pwOpen ? t("profile.cancel") : t("profile.changePassword")}
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
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            aria-describedby="dom-change-pw-rules"
            required
          />
          <ul
            className="dom-pw-rules"
            id="dom-change-pw-rules"
            aria-label={t("auth.pwRulesAria")}
          >
            {PASSWORD_RULES.map((rule) => {
              const met = rule.test(password);
              return (
                <li
                  key={rule.id}
                  className="dom-pw-rule"
                  data-met={met ? "1" : "0"}
                >
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
            <h2 className="dom-danger-modal-title">
              회원 탈퇴 · Delete account
            </h2>
            <p className="dom-danger-modal-body">
              This permanently deletes your account and all of its journal
              entries and shared cards. This <strong>cannot be undone</strong>.
              Type <strong>{email}</strong> to confirm.
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
              <Button
                variant="ghost"
                onClick={() => setConfirmOpen(false)}
                disabled={delBusy}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleDelete}
                disabled={!confirmed || delBusy}
              >
                {delBusy ? "Deleting…" : "Delete forever"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

const MAX_SHARED_CARDS = 200;

type SharedCardRow = {
  id: string;
  token: string;
  kind: "week" | "month" | "stats";
  created_at: string;
};

const SHARED_CARD_KIND_LABEL: Record<SharedCardRow["kind"], string> = {
  week: "주간 카드",
  month: "월간 카드",
  stats: "통계 카드",
};

function SharedLinksSummaryCard({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [total, setTotal] = useState<number | null>(null);
  const t = useT();

  const loadTotal = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    const { count, error } = await supabase
      .from("shared_cards")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    if (!error) setTotal(count ?? 0);
  }, [userId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadTotal(), 0);
    return () => window.clearTimeout(timer);
  }, [loadTotal]);

  const usagePercent =
    total === null ? 0 : Math.min(100, (total / MAX_SHARED_CARDS) * 100);

  return (
    <section className="dom-settings-card dom-share-summary-card">
      <div className="dom-settings-label">{t("profile.section.sharedLinks")}</div>

      <div className="dom-share-summary-main">
        <div
          className="dom-share-summary-count"
          aria-live="polite"
          aria-label={
            total === null
              ? "공유 링크 개수를 불러오는 중"
              : `공유 링크 ${total}개, 최대 ${MAX_SHARED_CARDS}개`
          }
        >
          <strong>{total ?? "—"}</strong>
          <span>/</span>
          <strong>{MAX_SHARED_CARDS}</strong>
        </div>
        <div
          className="dom-share-manager-meter"
          role="progressbar"
          aria-label="공유 링크 사용량"
          aria-valuemin={0}
          aria-valuemax={MAX_SHARED_CARDS}
          aria-valuenow={total ?? undefined}
        >
          <span style={{ width: `${usagePercent}%` }} />
        </div>
      </div>

      <p className="dom-settings-note">{t("profile.sharedLinks.note")}</p>

      <div className="dom-share-summary-action">
        <Button variant="ghost" onClick={() => setOpen(true)}>
          {t("profile.sharedLinks.manage")}
        </Button>
      </div>

      {open && (
        <SharedLinksModal
          userId={userId}
          onTotalChange={setTotal}
          onClose={() => setOpen(false)}
        />
      )}
    </section>
  );
}

function formatSharedCardDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function SharedLinksModal({
  userId,
  onTotalChange,
  onClose,
}: {
  userId: string;
  onTotalChange: (total: number) => void;
  onClose: () => void;
}) {
  const [cards, setCards] = useState<SharedCardRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadCards = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setLoadError(
        "공유 링크를 불러올 수 없습니다. Supabase 설정을 확인해 주세요.",
      );
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError("");
    const { data, count, error } = await supabase
      .from("shared_cards")
      .select("id, token, kind, created_at", { count: "exact" })
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(MAX_SHARED_CARDS);

    if (error) {
      setLoadError(
        "공유 링크를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
      );
      setLoading(false);
      return;
    }

    const nextTotal = count ?? data?.length ?? 0;
    setCards((data ?? []) as SharedCardRow[]);
    setTotal(nextTotal);
    onTotalChange(nextTotal);
    setLoading(false);
  }, [onTotalChange, userId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadCards(), 0);
    return () => window.clearTimeout(timer);
  }, [loadCards]);

  async function copyLink(token: string) {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/s/${token}`,
      );
      toast.success("공유 링크를 복사했어요.");
    } catch {
      toast.error("링크를 복사하지 못했습니다.");
    }
  }

  async function deleteLink(id: string) {
    if (deletingId) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      toast.error("공유 링크를 삭제할 수 없습니다.");
      return;
    }

    setDeletingId(id);
    const { error } = await supabase
      .from("shared_cards")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      toast.error("공유 링크를 삭제하지 못했습니다.");
      setDeletingId(null);
      return;
    }

    const nextTotal = Math.max(0, total - 1);
    setCards((current) => current.filter((card) => card.id !== id));
    setTotal(nextTotal);
    onTotalChange(nextTotal);
    setConfirmDeleteId(null);
    setDeletingId(null);
    toast.success("공유 링크가 삭제되었습니다.");
  }

  const usagePercent = Math.min(100, (total / MAX_SHARED_CARDS) * 100);

  return (
    <Modal
      label="공유 링크 관리"
      className="dom-share-manager-wrap"
      onClose={() => {
        if (!deletingId) onClose();
      }}
    >
      <section className="dom-share-manager">
        <header className="dom-share-manager-header">
          <div>
            <span className="dom-settings-label">shared links · 공유 링크</span>
            <h2>공유 링크 관리</h2>
          </div>
          <strong className="dom-share-manager-count">
            {total} / {MAX_SHARED_CARDS}
          </strong>
        </header>

        <div
          className="dom-share-manager-meter"
          role="progressbar"
          aria-label="공유 링크 사용량"
          aria-valuemin={0}
          aria-valuemax={MAX_SHARED_CARDS}
          aria-valuenow={Math.min(total, MAX_SHARED_CARDS)}
        >
          <span style={{ width: `${usagePercent}%` }} />
        </div>

        <p className="dom-share-manager-note">
          계정당 최대 {MAX_SHARED_CARDS}개의 링크를 보관할 수 있습니다. 링크를
          삭제하면 해당 주소는 즉시 열리지 않지만, 다른 사람이 이미 저장한
          이미지는 삭제되지 않습니다.
        </p>

        {loading ? (
          <div className="dom-share-manager-state" role="status">
            공유 링크를 불러오는 중…
          </div>
        ) : loadError ? (
          <div className="dom-share-manager-state">
            <p>{loadError}</p>
            <Button variant="ghost" size="sm" onClick={() => void loadCards()}>
              다시 시도
            </Button>
          </div>
        ) : cards.length === 0 ? (
          <div className="dom-share-manager-state">
            아직 만든 공유 링크가 없습니다.
          </div>
        ) : (
          <ul className="dom-share-list">
            {cards.map((card) => {
              const confirming = confirmDeleteId === card.id;
              const deleting = deletingId === card.id;
              return (
                <li className="dom-share-list-item" key={card.id}>
                  <div className="dom-share-list-info">
                    <strong>{SHARED_CARD_KIND_LABEL[card.kind]}</strong>
                    <span>{formatSharedCardDate(card.created_at)}</span>
                    <code title={card.token}>…{card.token.slice(-8)}</code>
                  </div>
                  <div className="dom-share-list-actions">
                    {confirming ? (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmDeleteId(null)}
                          disabled={deleting}
                        >
                          취소
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => void deleteLink(card.id)}
                          disabled={deleting}
                        >
                          {deleting ? "삭제 중…" : "링크 삭제"}
                        </Button>
                      </>
                    ) : (
                      <>
                        <a
                          className={buttonClass("ghost", "sm")}
                          href={`/s/${card.token}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          열기
                        </a>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void copyLink(card.token)}
                        >
                          복사
                        </Button>
                        <Button
                          variant="danger-ghost"
                          size="sm"
                          onClick={() => setConfirmDeleteId(card.id)}
                          disabled={Boolean(deletingId)}
                        >
                          삭제
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </Modal>
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
  const t = useT();
  const { locale } = useLanguage();
  // Country names + collation follow the current UI language. { code, label } →
  // { value, label } for DomSelectField; rebuilt only when the locale changes.
  const countryOptions = useMemo(
    () => countriesForLocale(locale).map((c) => ({ value: c.code, label: c.label })),
    [locale],
  );
  const handle = name.trim() || DEFAULT_USERNAME;
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
          size="medium"
        />
        <Button
          disabled={!dirty}
          onClick={() => onSave({ username: name.trim(), country })}
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
  onSave: (themes: Theme[]) => void;
}) {
  const [list, setList] = useState<Theme[]>(initial);
  const t = useT();
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
    setList((l) => [
      ...l,
      { id: crypto.randomUUID(), name: "New theme", emoji: "🎵" },
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
        <Button disabled={!dirty} onClick={() => onSave(list)}>
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
