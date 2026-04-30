import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const users = sqliteTable(
  "users",
  {
    groupId: text("group_id").primaryKey(),
    currentStage: text("current_stage").notNull(),
    groupName: text("group_name"),
    groupSize: integer("group_size"),
    q1Order: text("q1_order"),
    q1_1Cleared: integer("q1_1_cleared").notNull().default(0),
    q1_2Cleared: integer("q1_2_cleared").notNull().default(0),
    q2Cleared: integer("q2_cleared").notNull().default(0),
    startedAt: text("started_at"),
    completedAt: text("completed_at"),
    reportedAt: text("reported_at"),
    epilogueViewedAt: text("epilogue_viewed_at"),
    // 論理削除フラグ。0 = 有効、1 = 削除済み（dashboard には表示しない）。
    isDeleted: integer("is_deleted").notNull().default(0),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("idx_users_updated_at").on(table.updatedAt),
    index("idx_users_is_deleted").on(table.isDeleted),
  ],
);
