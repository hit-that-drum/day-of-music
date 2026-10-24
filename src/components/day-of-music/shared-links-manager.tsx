// shared-links-manager.tsx — the Profile page's share-link card: how many
// public links the account holds against the cap, and a manager to open, copy
// or delete them. The queries themselves live in share-links.ts.

"use client";

import { useId, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button, buttonClass } from "@/components/day-of-music/atoms";
import { Modal } from "@/components/day-of-music/modal";
import { dateTimeLong, useLanguage, useT, type Locale } from "@/lib/day-of-music/i18n";
import {
  MAX_SHARED_CARDS,
  countSharedCards,
  deleteSharedCard,
  listSharedCards,
  shareUrlForToken,
  type SharedCardRow,
} from "@/lib/day-of-music/share-links";

// Links are minted on other screens (under every share poster), so a cached
// count would be stale by the time the profile opens: refetch on each mount.
// No automatic retries either — a failed list shows its own Retry button.
const sharedCardsKeys = {
  all: (userId: string) => ["sharedCards", userId] as const,
  count: (userId: string) => ["sharedCards", userId, "count"] as const,
  list: (userId: string) => ["sharedCards", userId, "list"] as const,
};

function useSharedCardCount(userId: string) {
  return useQuery({
    queryKey: sharedCardsKeys.count(userId),
    queryFn: () => countSharedCards(userId),
    staleTime: 0,
    retry: false,
  });
}

function useSharedCards(userId: string) {
  return useQuery({
    queryKey: sharedCardsKeys.list(userId),
    queryFn: () => listSharedCards(userId),
    staleTime: 0,
    retry: false,
  });
}

function useDeleteSharedCard(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteSharedCard(userId, id),
    // Drop the link from the list and the count at once; the refetch below
    // then confirms both. (Not awaited, so the caller's toast doesn't wait.)
    onSuccess: (_data, id) => {
      queryClient.setQueryData<SharedCardRow[]>(sharedCardsKeys.list(userId), (cards) =>
        cards?.filter((card) => card.id !== id),
      );
      queryClient.setQueryData<number>(sharedCardsKeys.count(userId), (count) =>
        count === undefined ? count : Math.max(0, count - 1),
      );
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: sharedCardsKeys.all(userId) });
    },
  });
}

export function SharedLinksSummaryCard({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const t = useT();
  // null until the count loads, and when it couldn't: shown as "—".
  const total = useSharedCardCount(userId).data ?? null;

  const usagePercent =
    total === null ? 0 : Math.min(100, (total / MAX_SHARED_CARDS) * 100);

  return (
    <section className="dom-settings-card dom-share-summary-card">
      <div className="dom-label">{t("profile.section.sharedLinks")}</div>

      <div className="dom-share-summary-main">
        <div
          className="dom-share-summary-count"
          aria-live="polite"
          aria-label={
            total === null
              ? t("profile.sharedLinks.countLoading")
              : t("profile.sharedLinks.countAria", { count: total, max: MAX_SHARED_CARDS })
          }
        >
          <strong>{total ?? "—"}</strong>
          <span>/</span>
          <strong>{MAX_SHARED_CARDS}</strong>
        </div>
        <div
          className="dom-share-manager-meter"
          role="progressbar"
          aria-label={t("profile.sharedLinks.usageAria")}
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
        <SharedLinksModal userId={userId} onClose={() => setOpen(false)} />
      )}
    </section>
  );
}

function formatSharedCardDate(value: string, locale: Locale): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return dateTimeLong(locale, date);
}

function SharedLinksModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  const cardsQuery = useSharedCards(userId);
  // One count for the summary card and this header alike.
  const total = useSharedCardCount(userId).data ?? 0;
  const remove = useDeleteSharedCard(userId);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const t = useT();
  const { locale } = useLanguage();
  const titleId = useId();

  const cards = cardsQuery.data ?? [];
  // Retrying a failed load shows the loading state again, like the first load.
  const loading = cardsQuery.isPending || (cardsQuery.isError && cardsQuery.isFetching);
  // The link whose delete is in flight.
  const deletingId = remove.isPending ? (remove.variables ?? null) : null;

  async function copyLink(token: string) {
    try {
      await navigator.clipboard.writeText(shareUrlForToken(token));
      toast.success(t("profile.sharedLinks.copied"));
    } catch {
      toast.error(t("profile.sharedLinks.copyFailed"));
    }
  }

  function deleteLink(id: string) {
    if (deletingId) return;
    remove.mutate(id, {
      onSuccess: () => {
        setConfirmDeleteId(null);
        toast.success(t("profile.sharedLinks.deleted"));
      },
      onError: () => toast.error(t("profile.sharedLinks.deleteFailed")),
    });
  }

  const usagePercent = Math.min(100, (total / MAX_SHARED_CARDS) * 100);

  return (
    <Modal
      labelledBy={titleId}
      width={760}
      onClose={() => {
        if (!deletingId) onClose();
      }}
    >
      <section className="dom-share-manager">
        <header className="dom-share-manager-header">
          <div>
            <span className="dom-label">{t("profile.section.sharedLinks")}</span>
            <h2 id={titleId}>{t("profile.sharedLinks.title")}</h2>
          </div>
          <strong className="dom-share-manager-count">
            {total} / {MAX_SHARED_CARDS}
          </strong>
        </header>

        <div
          className="dom-share-manager-meter"
          role="progressbar"
          aria-label={t("profile.sharedLinks.usageAria")}
          aria-valuemin={0}
          aria-valuemax={MAX_SHARED_CARDS}
          aria-valuenow={Math.min(total, MAX_SHARED_CARDS)}
        >
          <span style={{ width: `${usagePercent}%` }} />
        </div>

        <p className="dom-share-manager-note">
          {t("profile.sharedLinks.limitNote", { max: MAX_SHARED_CARDS })}
        </p>

        {loading ? (
          <div className="dom-share-manager-state" role="status">
            {t("profile.sharedLinks.loading")}
          </div>
        ) : cardsQuery.isError ? (
          <div className="dom-share-manager-state">
            <p>{t("profile.sharedLinks.loadFailed")}</p>
            <Button variant="ghost" size="sm" onClick={() => void cardsQuery.refetch()}>
              {t("action.retry")}
            </Button>
          </div>
        ) : cards.length === 0 ? (
          <div className="dom-share-manager-state">
            {t("profile.sharedLinks.empty")}
          </div>
        ) : (
          <ul className="dom-share-list">
            {cards.map((card) => {
              const confirming = confirmDeleteId === card.id;
              const deleting = deletingId === card.id;
              return (
                <li className="dom-share-list-item" key={card.id}>
                  <div className="dom-share-list-info">
                    <strong>{t(`profile.sharedLinks.kind.${card.kind}`)}</strong>
                    <span>{formatSharedCardDate(card.created_at, locale)}</span>
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
                          {t("action.cancel")}
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => deleteLink(card.id)}
                          disabled={deleting}
                        >
                          {deleting ? t("action.deleting") : t("profile.sharedLinks.delete")}
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
                          {t("profile.sharedLinks.open")}
                        </a>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void copyLink(card.token)}
                        >
                          {t("profile.sharedLinks.copy")}
                        </Button>
                        <Button
                          variant="danger-ghost"
                          size="sm"
                          onClick={() => setConfirmDeleteId(card.id)}
                          disabled={Boolean(deletingId)}
                        >
                          {t("action.delete")}
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
