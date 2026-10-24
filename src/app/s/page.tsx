// /s?d=… — public view of a guest share link.
// Guests have no account row to point at, so the week-card snapshot travels
// inside the URL itself (deflate + base64url). Nothing is stored server-side;
// the payload is decoded and zod-validated here, and only week cards are
// accepted — signed-in kinds always go through /s/<token>.

import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  decodeGuestShareParam,
  sharedCardMetadata,
  weekSharePayloadSchema,
  type WeekSharePayload,
} from "@/lib/day-of-music/share-payload";
import { SharedCardView } from "@/components/day-of-music/shared-card-view";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

// cache() so the page and generateMetadata share one decode per request.
const decodePayload = cache(async (d: string): Promise<WeekSharePayload | null> => {
  const raw = await decodeGuestShareParam(d);
  const parsed = weekSharePayloadSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
});

async function payloadFromSearch(props: Props): Promise<WeekSharePayload | null> {
  const { d } = await props.searchParams;
  if (typeof d !== "string" || !d) return null;
  return decodePayload(d);
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  return sharedCardMetadata(await payloadFromSearch(props));
}

export default async function GuestSharedCardPage(props: Props) {
  const payload = await payloadFromSearch(props);
  if (!payload) notFound();
  return <SharedCardView payload={payload} />;
}
