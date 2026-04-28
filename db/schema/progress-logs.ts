import { sqliteTable, text, index } from "drizzle-orm/sqlite-core";

export const progressLogs = sqliteTable(
  "progress_logs",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id").notNull(),
    eventType: text("event_type").notNull(),
    fromStage: text("from_stage"),
    toStage: text("to_stage"),
    detail: text("detail"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("idx_progress_logs_group").on(table.groupId)],
);
