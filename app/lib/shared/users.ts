import { eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { users } from "../../../db/schema";

type UserRow = typeof users.$inferSelect;

export type CreateUserOpts = {
  groupName?: string | null;
  groupSize?: number | null;
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
  await db.insert(users).values({
    groupId,
    currentStage: "START",
    groupName: opts.groupName ?? null,
    groupSize: opts.groupSize ?? null,
    q1Order: null,
    createdAt: now,
    updatedAt: now,
  });
  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.groupId, groupId))
    .limit(1);
  return row;
}
