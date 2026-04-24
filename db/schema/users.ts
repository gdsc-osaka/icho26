import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const users = sqliteTable(
  "users",
  {
    groupId: text("group_id").primaryKey(),
    currentStage: text("current_stage").notNull().default("START"),
    stateVersion: integer("state_version").notNull().default(0),
    q1Order: text("q1_order"),
    currentUnlockedSubquestion: text("current_unlocked_subquestion"),
    q1_1Completed: integer("q1_1_completed").notNull().default(0),
    q1_2Completed: integer("q1_2_completed").notNull().default(0),
    q2Completed: integer("q2_completed").notNull().default(0),
    q3KeywordCompleted: integer("q3_keyword_completed").notNull().default(0),
    q3CodeCompleted: integer("q3_code_completed").notNull().default(0),
    q4Completed: integer("q4_completed").notNull().default(0),
    reported: integer("reported").notNull().default(0),
    startedAt: text("started_at"),
    completedAt: text("completed_at"),
    reportedAt: text("reported_at"),
    epilogueViewedAt: text("epilogue_viewed_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("idx_users_updated_at").on(table.updatedAt)]
);
