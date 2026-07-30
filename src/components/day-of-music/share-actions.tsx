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
      toast.success("Link copied");
      setConfirmOpen(false);
    } catch {
      toast.error("Couldn't create share link");
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
            Create public link · 공개 링크 만들기
          </Button>
        ) : configured && !loading ? (
          <Link href="/signin" className={buttonClass("ghost")}>
            Sign in to share
          </Link>
        ) : null}
        <Button onClick={onSaveImage}>Save image</Button>
      </div>
      {guestWeekLink && (
        <p className="dom-share-guest-warning" role="note">
          게스트 공유 링크는 삭제하거나 회수할 수 없습니다. 링크를 받은 누구나
          열람할 수 있습니다.
        </p>
      )}

      {confirmOpen && (
        <Modal
          label="공개 링크 생성 확인"
          className="dom-public-link-modal-wrap"
          onClose={() => {
            if (!busy) setConfirmOpen(false);
          }}
        >
          <div className="dom-public-link-modal">
            <span className="dom-settings-label">public link · 공개 링크</span>
            <h2>공개 링크를 만들까요?</h2>
            <p>
              닉네임, 음악 기록, 평점 및 테마명이 링크를 받은 사람에게
              공개됩니다. 이메일과 감상 메모는 포함되지 않습니다.
            </p>
            <div className="dom-public-link-notice">
              {signedIn ? (
                <>
                  <strong>로그인 사용자 링크</strong>
                  <span>
                    링크는 90일 후 만료되며 프로필에서 언제든 삭제할 수
                    있습니다.
                  </span>
                </>
              ) : (
                <>
                  <strong>게스트 링크</strong>
                  <span>
                    링크를 받은 누구나 열람할 수 있으며, 생성 후에는 삭제하거나
                    회수할 수 없습니다.
                  </span>
                </>
              )}
            </div>
            <div className="dom-settings-actions">
              <Button
                variant="ghost"
                onClick={() => setConfirmOpen(false)}
                disabled={busy}
              >
                Cancel · 취소
              </Button>
              <Button
                onClick={() => void handleCreatePublicLink()}
                disabled={busy}
              >
                {busy ? "Creating…" : "Create & copy · 생성 후 복사"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
