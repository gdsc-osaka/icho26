import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const checkpointCodes = sqliteTable("checkpoint_codes", {
  code: text("code").primaryKey(),
  stage: text("stage").notNull(),
  label: text("label"),
  active: integer("active").notNull().default(1),
  createdAt: text("created_at").notNull(),
});
