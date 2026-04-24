import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const operatorCredentials = sqliteTable("operator_credentials", {
  operatorId: text("operator_id").primaryKey(),
  passwordHashB64: text("password_hash_b64").notNull(),
  passwordSaltB64: text("password_salt_b64").notNull(),
  passwordIterations: integer("password_iterations").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const operatorSessions = sqliteTable(
  "operator_sessions",
  {
    sessionId: text("session_id").primaryKey(),
    operatorId: text("operator_id").notNull(),
    expiresAt: text("expires_at").notNull(),
    revokedAt: text("revoked_at"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("idx_operator_sessions_expires").on(table.expiresAt)]
);

export const operatorSessionEvents = sqliteTable(
  "operator_session_events",
  {
    id: text("id").primaryKey(),
    operatorId: text("operator_id").notNull(),
    sessionId: text("session_id").notNull(),
    eventType: text("event_type").notNull(),
    ipAddress: text("ip_address"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("idx_operator_session_events_created_at").on(table.createdAt),
  ]
);
