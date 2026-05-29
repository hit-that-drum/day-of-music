// /api/journal — list + upsert journal entries, scoped per user.
//
// Auth model:
//  - When Supabase is configured, a valid Bearer access token is required; the
//    user id is derived from it and all rows are scoped to that user.
//  - When Supabase is NOT configured, the route runs unauthenticated (single
//    shared journal) so the app works in local dev without Supabase.
//
// Persistence degrades gracefully: with no database configured, GET returns an
// empty list and PUT echoes the entry back (persisted:false) so the client falls
// back to its localStorage write-through.

import { eq, sql } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/lib/db";
import { journalEntries } from "@/lib/db/schema";
import {
  getUserIdFromRequest,
  isSupabaseServerConfigured,
} from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function hasDatabase(): boolean {
  return Boolean(process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL);
}

const entrySchema = z.object({
  albumId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  rating: z.coerce.number().int().min(0).max(5).default(0),
  note: z.string().default(""),
  mood: z.array(z.string()).default([]),
});

function unauthorized() {
  return Response.json({ error: "Authentication required." }, { status: 401 });
}

export async function GET(request: Request) {
  const userId = await getUserIdFromRequest(request);
  if (isSupabaseServerConfigured() && !userId) return unauthorized();

  if (!hasDatabase()) {
    return Response.json({ entries: [], persisted: false });
  }

  try {
    const db = getDb();
    const rows = await db
      .select({
        albumId: journalEntries.albumId,
        date: journalEntries.date,
        rating: journalEntries.rating,
        note: journalEntries.note,
        mood: journalEntries.mood,
      })
      .from(journalEntries)
      .where(
        userId ? eq(journalEntries.userId, userId) : sql`${journalEntries.userId} is null`,
      );
    return Response.json({ entries: rows, persisted: true });
  } catch (error) {
    console.error("GET /api/journal failed", error);
    return Response.json({ entries: [], persisted: false });
  }
}

export async function PUT(request: Request) {
  const userId = await getUserIdFromRequest(request);
  if (isSupabaseServerConfigured() && !userId) return unauthorized();

  const json = await request.json().catch(() => null);
  const parsed = entrySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid entry.", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const entry = parsed.data;

  if (!hasDatabase()) {
    return Response.json({ entry, persisted: false });
  }

  try {
    const db = getDb();
    await db
      .insert(journalEntries)
      .values({ ...entry, userId })
      .onConflictDoUpdate({
        target: [journalEntries.userId, journalEntries.albumId],
        set: {
          date: entry.date,
          rating: entry.rating,
          note: entry.note,
          mood: entry.mood,
          updatedAt: sql`now()`,
        },
      });
    return Response.json({ entry, persisted: true });
  } catch (error) {
    console.error("PUT /api/journal failed", error);
    return Response.json({ entry, persisted: false }, { status: 200 });
  }
}
