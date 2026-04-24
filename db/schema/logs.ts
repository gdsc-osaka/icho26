import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const userProgressLogs = sqliteTable(
  "user_progress_logs",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id").notNull(),
    eventType: text("event_type").notNull(),
    fromStage: text("from_stage"),
    toStage: text("to_stage"),
    detail: text("detail"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("idx_user_progress_logs_created_at").on(table.createdAt),
    index("idx_user_progress_logs_group").on(table.groupId),
  ]
);

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
    index("idx_attempt_logs_created_at").on(table.createdAt),
    index("idx_attempt_logs_group_stage").on(table.groupId, table.stage),
  ]
);

export const hintLogs = sqliteTable(
  "hint_logs",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id").notNull(),
    stage: text("stage").notNull(),
    userMessage: text("user_message").notNull(),
    assistantMessage: text("assistant_message").notNull(),
    hintLevel: integer("hint_level").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("idx_hint_logs_created_at").on(table.createdAt)]
);

export const operatorActions = sqliteTable(
  "operator_actions",
  {
    id: text("id").primaryKey(),
    operatorId: text("operator_id").notNull(),
    groupId: text("group_id").notNull(),
    actionType: text("action_type").notNull(),
    fromStage: text("from_stage"),
    toStage: text("to_stage"),
    reasonCode: text("reason_code").notNull(),
    note: text("note"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("idx_operator_actions_created_at").on(table.createdAt)]
);
