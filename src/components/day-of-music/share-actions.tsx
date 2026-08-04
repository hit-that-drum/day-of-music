// share-actions.tsx — the action row under every share poster.
// Copy link mints a public share URL from the poster's payload snapshot:
// signed-in users get a stored-snapshot link (/s/<token>) for any card;
// guests get a link only for the week card (payload encoded into the URL,
// nothing stored server-side) and a sign-in nudge on the other cards.

"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";

import {
  createGuestWeekLink,
  createSharedCardLink,
  type SharePayload,
} from "@/lib/day-of-music/share-links";
import { useT } from "@/lib/day-of-music/i18n";
import { useAuth } from "@/components/day-of-music/auth-provider";
import { Button, buttonClass } from "@/components/day-of-music/atoms";
import { Modal } from "@/components/day-of-music/modal";

export function ShareActions({
  payload,
  onSaveImage,
}: {
  payload: SharePayload;
  onSaveImage: () => void;
}) {
  const { configured, loading, user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const t = useT();

  const signedIn = configured && Boolean(user);
  const guestWeekLink = !loading && !signedIn && payload.kind === "week";
  // Guests (and unconfigured local mode) can still share the week card — the
  // payload travels in the URL itself, so no account or server row is needed.
  const canCopyLink = !loading && (signedIn || payload.kind === "week");

  async function handleCreatePublicLink() {
    setBusy(true);
    try {
      const url =
        signedIn && user
          ? await createSharedCardLink(user.id, payload)
          : await createGuestWeekLink(
              payload as Extract<SharePayload, { kind: "week" }>,
            );
      await navigator.clipboard.writeText(url);
      toast.success(t("share.toastCopied"));
      setConfirmOpen(false);
    } catch {
      toast.error(t("share.toastError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dom-share-actions-wrap">
      <div className="dom-share-actions">
        {canCopyLink ? (
          <Button
            variant="ghost"
            onClick={() => setConfirmOpen(true)}
            disabled={busy}
          >
            {t("share.createLink")}
          </Button>
        ) : configured && !loading ? (
          <Link href="/signin" className={buttonClass("ghost")}>
            {t("share.signInToShare")}
          </Link>
        ) : null}
        <Button onClick={onSaveImage}>{t("share.saveImage")}</Button>
      </div>
      {guestWeekLink && (
        <p className="dom-share-guest-warning" role="note">
          {t("share.guestWarning")}
        </p>
      )}

      {confirmOpen && (
        <Modal
          label={t("share.confirmModalLabel")}
          className="dom-public-link-modal-wrap"
          onClose={() => {
            if (!busy) setConfirmOpen(false);
          }}
        >
          <div className="dom-public-link-modal">
            <span className="dom-settings-label">{t("share.publicLinkLabel")}</span>
            <h2>{t("share.confirmTitle")}</h2>
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
          </div>
        </Modal>
      )}
    </div>
  );
}
