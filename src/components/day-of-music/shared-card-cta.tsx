// The public share page CTA depends on the viewer's browser session. Keep this
// tiny client boundary separate so the share-card snapshot itself stays
// server-rendered.

"use client";

import Link from "next/link";

import { buttonClass } from "@/components/day-of-music/atoms";
import { useAuth } from "@/components/day-of-music/auth-provider";

export function SharedCardCta() {
  const { loading, user } = useAuth();

  // Hide while the persisted Supabase session is being restored so signed-in
  // viewers never see the CTA flash briefly before it disappears.
  if (loading || user) return null;

  return (
    <div className="dom-share-actions">
      <Link href="/week" className={buttonClass("solid")}>
        Make your own →
      </Link>
    </div>
  );
}
