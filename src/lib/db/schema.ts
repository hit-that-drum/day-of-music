import { relations } from "drizzle-orm";
import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const musicBoards = pgTable("music_boards", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id"),
  title: text("title").notNull(),
  monthLabel: text("month_label").notNull(),
  weekLabel: text("week_label").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const musicBoardItems = pgTable("music_board_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  boardId: uuid("board_id")
    .notNull()
    .references(() => musicBoards.id, { onDelete: "cascade" }),
  dayIndex: integer("day_index").notNull(),
  day: integer("day").notNull(),
  weekday: text("weekday").notNull(),
  title: text("title").notNull(),
  artist: text("artist").notNull(),
  releaseType: text("release_type").notNull(),
  releaseDate: text("release_date").notNull(),
  genre: text("genre").notNull(),
  label: text("label").notNull(),
  coverUrl: text("cover_url"),
  accent: text("accent").notNull(),
  background: text("background").notNull(),
  source: text("source"),
  sourceId: text("source_id"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
});

export const musicBoardsRelations = relations(musicBoards, ({ many }) => ({
  items: many(musicBoardItems),
}));

export const musicBoardItemsRelations = relations(
  musicBoardItems,
  ({ one }) => ({
    board: one(musicBoards, {
      fields: [musicBoardItems.boardId],
      references: [musicBoards.id],
    }),
  }),
);

export type MusicBoard = typeof musicBoards.$inferSelect;
export type NewMusicBoard = typeof musicBoards.$inferInsert;
export type MusicBoardItem = typeof musicBoardItems.$inferSelect;
export type NewMusicBoardItem = typeof musicBoardItems.$inferInsert;
