import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const operatorCredentials = sqliteTable("operator_credentials", {
  operatorId: text("operator_id").primaryKey(),
  passwordHashB64: text("password_hash_b64").notNull(),
  passwordSaltB64: text("password_salt_b64").notNull(),
  passwordIterations: integer("password_iterations").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
