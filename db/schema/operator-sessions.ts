import { sqliteTable, text, index } from "drizzle-orm/sqlite-core";

export const operatorSessions = sqliteTable(
  "operator_sessions",
  {
    sessionId: text("session_id").primaryKey(),
    operatorId: text("operator_id").notNull(),
    expiresAt: text("expires_at").notNull(),
    revokedAt: text("revoked_at"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("idx_operator_sessions_expires").on(table.expiresAt)],
);
