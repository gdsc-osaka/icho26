import { and, eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import {
  attemptLogs,
  checkpointCodes,
  users,
} from "../../../db/schema";
import type { AnswerStage, SubQuestion, UserRow } from "./types";

export async function findUserByGroupId(
  db: DrizzleD1Database,
  groupId: string,
): Promise<UserRow | null> {
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.groupId, groupId))
    .limit(1);
  return rows[0] ?? null;
}

export async function getCheckpointCode(
  db: DrizzleD1Database,
  code: string,
): Promise<{ stage: string } | null> {
  const rows = await db
    .select({ stage: checkpointCodes.stage })
    .from(checkpointCodes)
    .where(and(eq(checkpointCodes.code, code), eq(checkpointCodes.active, 1)))
    .limit(1);
  return rows[0] ?? null;
}

export async function hasCorrectAttempt(
  db: DrizzleD1Database,
  groupId: string,
  stage: AnswerStage | SubQuestion,
): Promise<boolean> {
  const rows = await db
    .select({ id: attemptLogs.id })
    .from(attemptLogs)
    .where(
      and(
        eq(attemptLogs.groupId, groupId),
        eq(attemptLogs.stage, stage),
        eq(attemptLogs.correct, 1),
      ),
    )
    .limit(1);
  return rows.length > 0;
}
