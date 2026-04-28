import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const operatorActions = sqliteTable("operator_actions", {
  id: text("id").primaryKey(),
  operatorId: text("operator_id").notNull(),
  groupId: text("group_id").notNull(),
  actionType: text("action_type").notNull(),
  fromStage: text("from_stage"),
  toStage: text("to_stage"),
  reasonCode: text("reason_code").notNull(),
  note: text("note"),
  createdAt: text("created_at").notNull(),
});
