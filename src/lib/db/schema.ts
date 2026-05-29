import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

// One logged album per entry, keyed by (user, catalog album id). The album
// metadata (title, artist, cover, …) lives in the static catalog; this table
// stores only the journal layer the user owns: which day it was logged, the
// rating, the note, and the mood tags. Entries are scoped per account so two
// users can independently log the same album.
export const journalEntries = pgTable(
  "journal_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id"),
    albumId: text("album_id").notNull(),
    date: text("date").notNull(), // YYYY-MM-DD
    rating: integer("rating").notNull().default(0),
    note: text("note").notNull().default(""),
    mood: jsonb("mood").$type<string[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [unique("journal_entries_user_album_unique").on(t.userId, t.albumId)],
);

export type JournalEntry = typeof journalEntries.$inferSelect;
export type NewJournalEntry = typeof journalEntries.$inferInsert;
