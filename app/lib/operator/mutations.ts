import { and, eq, isNull } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../../../db/schema";
import type { Stage } from "../../../db/schema";

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

// `createUser` lives in `~/lib/shared/users.ts` — see that module.

export async function correctStatus(
  db: DrizzleD1Database<typeof schema>,
  params: {
    operatorId: string;
    groupId: string;
    fromStage: Stage | null;
    toStage: Stage;
    reasonCode: string;
    note: string | null;
    now: string;
  },
): Promise<void> {
  const actionId = crypto.randomUUID();
  const progressId = crypto.randomUUID();

  await db.batch([
    db
      .update(schema.users)
      .set({ currentStage: params.toStage, updatedAt: params.now })
      .where(eq(schema.users.groupId, params.groupId)),
    db.insert(schema.operatorActions).values({
      id: actionId,
      operatorId: params.operatorId,
      groupId: params.groupId,
      actionType: "STATUS_CORRECTION",
      fromStage: params.fromStage,
      toStage: params.toStage,
      reasonCode: params.reasonCode,
      note: params.note,
      createdAt: params.now,
    }),
    db.insert(schema.progressLogs).values({
      id: progressId,
      groupId: params.groupId,
      eventType: "STAGE_TRANSITION",
      fromStage: params.fromStage,
      toStage: params.toStage,
      detail: JSON.stringify({
        source: "operator_correction",
        reasonCode: params.reasonCode,
      }),
      createdAt: params.now,
    }),
  ]);
}

export async function markReported(
  db: DrizzleD1Database<typeof schema>,
  params: {
    operatorId: string;
    groupId: string;
    reasonCode: string;
    note: string | null;
    now: string;
  },
): Promise<void> {
  const actionId = crypto.randomUUID();

  await db.batch([
    db
      .update(schema.users)
      .set({ reportedAt: params.now, updatedAt: params.now })
      .where(eq(schema.users.groupId, params.groupId)),
    db.insert(schema.operatorActions).values({
      id: actionId,
      operatorId: params.operatorId,
      groupId: params.groupId,
      actionType: "MARK_REPORTED",
      fromStage: null,
      toStage: null,
      reasonCode: params.reasonCode,
      note: params.note,
      createdAt: params.now,
    }),
  ]);
}
