// /s/[token] — public view of a stored share-card snapshot.
// The token is the whole secret: it's looked up through the token-gated
// get_shared_card RPC (no table-level public read), the payload is
// zod-validated, and the page is noindex + no-referrer so the capability URL
// doesn't leak through crawlers or outbound clicks.

import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  shareDescription,
  sharePayloadSchema,
  type SharePayload,
} from "@/lib/day-of-music/share-links";
import { SharedCardView } from "@/components/day-of-music/shared-card-view";

// Snapshots are looked up per request; nothing here is prerenderable.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ token: string }> };

// cache() so the page and generateMetadata share one lookup per request.
const getSharedCard = cache(async (token: string): Promise<SharePayload | null> => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null;
  try {
    const res = await fetch(`${url}/rest/v1/rpc/get_shared_card`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ share_token: token }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as { payload?: unknown }[];
    const parsed = sharePayloadSchema.safeParse(rows?.[0]?.payload);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const payload = await getSharedCard(token);
  const base: Metadata = {
    robots: { index: false, follow: false },
    referrer: "no-referrer",
  };
  if (!payload) return { ...base, title: "Shared card — Day of Music" };
  const description = shareDescription(payload);
  return {
    ...base,
    title: `${payload.title} — Day of Music`,
    description,
    openGraph: {
      title: payload.title,
      description,
      siteName: "Day of Music",
      type: "website",
    },
  };
}

export default async function SharedCardPage({ params }: Props) {
  const { token } = await params;
  const payload = await getSharedCard(token);
  if (!payload) notFound();
  return <SharedCardView payload={payload} />;
}
