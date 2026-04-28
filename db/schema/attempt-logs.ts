import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const attemptLogs = sqliteTable(
  "attempt_logs",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id").notNull(),
    stage: text("stage").notNull(),
    rawInput: text("raw_input").notNull(),
    normalizedInput: text("normalized_input").notNull(),
    correct: integer("correct").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("idx_attempt_logs_group_stage").on(table.groupId, table.stage),
  ],
);
