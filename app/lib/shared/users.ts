import { eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { users } from "../../../db/schema";

type UserRow = typeof users.$inferSelect;
type UserInsert = typeof users.$inferInsert;

export type CreateUserOpts = {
  groupName?: string | null;
  groupSize?: number | null;
  /** ISO 8601 timestamp. Set when issuing as a reservation; null/undefined for immediate issue. */
  reservedAt?: string | null;
};

/**
 * Insert a fresh `users` row at `START` stage and return it.
 *
 * Single source of truth shared by:
 *   - operator dashboard "新規 ID 発行" (issues the row up-front, with name/size)
 *   - participant `/start/:groupId` first-time access (creates on demand, no metadata)
 *
 * Cleared flags (q1_1, q1_2, q2) are left to the schema defaults (0).
 */
// Generic over the schema so the function accepts both bare
// `drizzle(env.DB)` (participant routes) and
// `drizzle(env.DB, { schema })` (operator routes).
export async function createUser<TSchema extends Record<string, unknown>>(
  db: DrizzleD1Database<TSchema>,
  groupId: string,
  now: string,
  opts: CreateUserOpts = {},
): Promise<UserRow> {
  // Only include badge metadata columns when explicitly provided. Omitting
  // them keeps the participant `/start/:groupId` fallback compatible with
  // environments where migration 0001 has not yet been applied (the columns
  // would not exist, causing "no such column" errors).
  const values: UserInsert = {
    groupId,
    currentStage: "START",
    q1Order: null,
    createdAt: now,
    updatedAt: now,
  };
  if (opts.groupName !== undefined) values.groupName = opts.groupName;
  if (opts.groupSize !== undefined) values.groupSize = opts.groupSize;
  if (opts.reservedAt !== undefined) values.reservedAt = opts.reservedAt;

  await db.insert(users).values(values);
  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.groupId, groupId))
    .limit(1);
  return row;
}
