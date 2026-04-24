import { sqliteTable, text, integer, index, primaryKey } from "drizzle-orm/sqlite-core";

export const idempotencyKeys = sqliteTable(
  "idempotency_keys",
  {
    groupId: text("group_id").notNull(),
    apiName: text("api_name").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    responseJson: text("response_json").notNull(),
    statusCode: integer("status_code").notNull(),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.groupId, table.apiName, table.idempotencyKey] }),
    index("idx_idempotency_expires").on(table.expiresAt),
  ]
);
