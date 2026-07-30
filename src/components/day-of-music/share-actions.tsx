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

export function ShareActions({
  payload,
  onSaveImage,
}: {
  payload: SharePayload;
  onSaveImage: () => void;
}) {
  const { configured, loading, user } = useAuth();
  const [busy, setBusy] = useState(false);

  const signedIn = configured && Boolean(user);
  const guestWeekLink = !loading && !signedIn && payload.kind === "week";
  // Guests (and unconfigured local mode) can still share the week card — the
  // payload travels in the URL itself, so no account or server row is needed.
  const canCopyLink = !loading && (signedIn || payload.kind === "week");

  async function handleCopyLink() {
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
            onClick={() => void handleCopyLink()}
            disabled={busy}
          >
            {busy ? "One moment…" : "Copy link"}
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
    </div>
  );
}
