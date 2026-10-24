// share-actions.tsx — the action row under every share poster.
// Copy link mints a public share URL from the poster's payload snapshot:
// signed-in users get a stored-snapshot link (/s/<token>) for any card;
// guests get a link only for the week card (payload encoded into the URL,
// nothing stored server-side) and a sign-in nudge on the other cards.

"use client";

import { useId, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";

import { createGuestWeekLink, createSharedCardLink } from "@/lib/day-of-music/share-links";
import type { SharePayload } from "@/lib/day-of-music/share-payload";
import { useT } from "@/lib/day-of-music/i18n";
import { useAuth } from "@/lib/day-of-music/auth-provider";
import { Button, buttonClass } from "@/components/day-of-music/atoms";
import { Modal } from "@/components/day-of-music/modal";

export function ShareActions({
  payload,
  onSaveImage,
}: {
  payload: SharePayload;
  /** Resolves whether the PNG was produced (see saveCardAsImage). */
  onSaveImage: () => Promise<boolean>;
}) {
  const { configured, loading, user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  // A link that was created but not copied: the clipboard refused it (iOS
  // Safari does once an await has consumed the click). It stays in the dialog
  // to copy from, so trying again never mints — and rate-limits — another row.
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const t = useT();
  const confirmTitleId = useId();

  const signedIn = configured && Boolean(user);
  const guestWeekLink = !loading && !signedIn && payload.kind === "week";
  // Guests (and unconfigured local mode) can still share the week card — the
  // payload travels in the URL itself, so no account or server row is needed.
  const canCopyLink = !loading && (signedIn || payload.kind === "week");

  function mintLink(): Promise<string> {
    if (signedIn && user) return createSharedCardLink(user.id, payload);
    // Guests can only link the week card (its payload rides in the URL), and
    // the button is only offered for it — canCopyLink above.
    if (payload.kind === "week") return createGuestWeekLink(payload);
    return Promise.reject(new Error("Only the week card has a guest link"));
  }

  async function handleCreatePublicLink() {
    setBusy(true);
    let url: string;
    try {
      url = await mintLink();
    } catch {
      toast.error(t("share.toastError"));
      setBusy(false);
      return;
    }
    // Copying is a separate step: a refused copy must not read as a failed link.
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("share.toastCopied"));
      setConfirmOpen(false);
    } catch {
      setCreatedUrl(url);
    } finally {
      setBusy(false);
    }
  }

  // From a fresh click, which the clipboard accepts where the post-await copy
  // above was refused. If it still fails, the link is selected to copy by hand.
  async function copyCreatedUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("share.toastCopied"));
      setConfirmOpen(false);
    } catch {
      toast.error(t("share.toastCopyFailed"));
      urlInputRef.current?.select();
    }
  }

  async function saveImage() {
    if (await onSaveImage()) toast.success(t("share.imageSaved"));
    else toast.error(t("share.imageFailed"));
  }

  return (
    <div className="dom-share-actions-wrap">
      <div className="dom-share-actions">
        {canCopyLink ? (
          <Button
            variant="ghost"
            onClick={() => {
              setCreatedUrl(null);
              setConfirmOpen(true);
            }}
            disabled={busy}
          >
            {t("share.createLink")}
          </Button>
        ) : configured && !loading ? (
          <Link href="/signin" className={buttonClass("ghost")}>
            {t("share.signInToShare")}
          </Link>
        ) : null}
        <Button onClick={saveImage}>{t("share.saveImage")}</Button>
      </div>
      {guestWeekLink && (
        <p className="dom-share-guest-warning" role="note">
          {t("share.guestWarning")}
        </p>
      )}

      {confirmOpen && (
        <Modal
          labelledBy={confirmTitleId}
          className="dom-public-link-modal-wrap"
          onClose={() => {
            if (!busy) setConfirmOpen(false);
          }}
        >
          <div className="dom-public-link-modal">
            <span className="dom-settings-label">{t("share.publicLinkLabel")}</span>
            {createdUrl ? (
              <>
                <h2 id={confirmTitleId}>{t("share.createdTitle")}</h2>
                <p role="status">{t("share.copyFailedBody")}</p>
                <input
                  ref={urlInputRef}
                  className="dom-input"
                  readOnly
                  value={createdUrl}
                  aria-label={t("share.publicLinkLabel")}
                  onFocus={(e) => e.currentTarget.select()}
                />
                <div className="dom-settings-actions">
                  <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
                    {t("modal.close")}
                  </Button>
                  <Button onClick={() => void copyCreatedUrl(createdUrl)}>{t("share.copyLink")}</Button>
                </div>
              </>
            ) : (
              <>
                <h2 id={confirmTitleId}>{t("share.confirmTitle")}</h2>
                <p>{t("share.confirmBody")}</p>
                <div className="dom-public-link-notice">
                  {signedIn ? (
                    <>
                      <strong>{t("share.signedInLinkTitle")}</strong>
                      <span>{t("share.signedInLinkNote")}</span>
                    </>
                  ) : (
                    <>
                      <strong>{t("share.guestLinkTitle")}</strong>
                      <span>{t("share.guestLinkNote")}</span>
                    </>
                  )}
                </div>
                <div className="dom-settings-actions">
                  <Button
                    variant="ghost"
                    onClick={() => setConfirmOpen(false)}
                    disabled={busy}
                  >
                    {t("action.cancel")}
                  </Button>
                  <Button
                    onClick={() => void handleCreatePublicLink()}
                    disabled={busy}
                  >
                    {busy ? t("share.creating") : t("share.createCopy")}
                  </Button>
                </div>
              </>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
