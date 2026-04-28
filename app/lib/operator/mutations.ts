import { and, eq, isNull } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../../../db/schema";

export async function createSession(
  db: DrizzleD1Database<typeof schema>,
  params: {
    sessionId: string;
    operatorId: string;
    expiresAt: string;
    createdAt: string;
  },
): Promise<void> {
  await db.insert(schema.operatorSessions).values(params);
}

export async function revokeSession(
  db: DrizzleD1Database<typeof schema>,
  sessionId: string,
  now: string,
): Promise<void> {
  await db
    .update(schema.operatorSessions)
    .set({ revokedAt: now })
    .where(
      and(
        eq(schema.operatorSessions.sessionId, sessionId),
        isNull(schema.operatorSessions.revokedAt),
      ),
    );
}

export async function createUser(
  db: DrizzleD1Database<typeof schema>,
  params: { groupId: string; now: string },
): Promise<void> {
  await db.insert(schema.users).values({
    groupId: params.groupId,
    currentStage: "START",
    q1_1Cleared: 0,
    q1_2Cleared: 0,
    q2Cleared: 0,
    createdAt: params.now,
    updatedAt: params.now,
  });
}
