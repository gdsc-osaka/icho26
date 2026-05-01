import { and, eq, isNotNull, isNull } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../../../db/schema";
import type { Q1Order, Stage } from "../../../db/schema";

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

export type StatusCorrectionFlags = {
  /** Q1_1 のクリアフラグ。undefined のときは変更しない。 */
  q1_1Cleared?: 0 | 1;
  /** Q1_2 のクリアフラグ。undefined のときは変更しない。 */
  q1_2Cleared?: 0 | 1;
  /** Q2 のクリアフラグ。undefined のときは変更しない。 */
  q2Cleared?: 0 | 1;
  /** Q1 の出題順序。undefined のときは変更しない。null を指定すると未割当に戻す。 */
  q1Order?: Q1Order | null;
};

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
  } & StatusCorrectionFlags,
): Promise<void> {
  const actionId = crypto.randomUUID();
  const progressId = crypto.randomUUID();

  const userUpdate: Partial<typeof schema.users.$inferInsert> = {
    currentStage: params.toStage,
    updatedAt: params.now,
  };
  if (params.q1_1Cleared !== undefined)
    userUpdate.q1_1Cleared = params.q1_1Cleared;
  if (params.q1_2Cleared !== undefined)
    userUpdate.q1_2Cleared = params.q1_2Cleared;
  if (params.q2Cleared !== undefined) userUpdate.q2Cleared = params.q2Cleared;
  if (params.q1Order !== undefined) userUpdate.q1Order = params.q1Order;

  await db.batch([
    db
      .update(schema.users)
      .set(userUpdate)
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
        q1_1Cleared: params.q1_1Cleared,
        q1_2Cleared: params.q1_2Cleared,
        q2Cleared: params.q2Cleared,
        q1Order: params.q1Order,
      }),
      createdAt: params.now,
    }),
  ]);
}

/**
 * グループの論理削除（is_deleted = 1）。dashboard 一覧やステータス補正対象から除外する。
 * 物理削除はしないため、後で復活や監査が可能。
 */
export async function softDeleteUser(
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
      .set({ isDeleted: 1, updatedAt: params.now })
      .where(eq(schema.users.groupId, params.groupId)),
    db.insert(schema.operatorActions).values({
      id: actionId,
      operatorId: params.operatorId,
      groupId: params.groupId,
      actionType: "SOFT_DELETE",
      fromStage: null,
      toStage: null,
      reasonCode: params.reasonCode,
      note: params.note,
      createdAt: params.now,
    }),
  ]);
}

/**
 * 待機中の予約 (reserved_at IS NOT NULL AND admitted_at IS NULL) に対して
 * admitted_at を打つ。参加者の /start 画面側で START ボタンを開放する判定に使う。
 *
 * 既に admit 済み・未予約・soft-deleted な行に対しては Error を投げる。
 */
export async function admitReservation(
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
  const updated = await db
    .update(schema.users)
    .set({ admittedAt: params.now, updatedAt: params.now })
    .where(
      and(
        eq(schema.users.groupId, params.groupId),
        isNotNull(schema.users.reservedAt),
        isNull(schema.users.admittedAt),
        eq(schema.users.isDeleted, 0),
      ),
    )
    .returning({ groupId: schema.users.groupId });

  if (updated.length === 0) {
    const [row] = await db
      .select({
        reservedAt: schema.users.reservedAt,
        admittedAt: schema.users.admittedAt,
        isDeleted: schema.users.isDeleted,
      })
      .from(schema.users)
      .where(eq(schema.users.groupId, params.groupId))
      .limit(1);

    if (!row) throw new Error(`group not found: ${params.groupId}`);
    if (!row.reservedAt) throw new Error(`group is not a reservation`);
    if (row.admittedAt) throw new Error(`reservation already admitted`);
    if (row.isDeleted === 1) throw new Error(`reservation has been canceled`);
    throw new Error(`reservation could not be admitted`);
  }

  await db.insert(schema.operatorActions).values({
    id: actionId,
    operatorId: params.operatorId,
    groupId: params.groupId,
    actionType: "RESERVATION_ADMIT",
    fromStage: null,
    toStage: null,
    reasonCode: params.reasonCode,
    note: params.note,
    createdAt: params.now,
  });
}

/**
 * 予約のキャンセル。is_deleted = 1 を立てて待機列から除外する。
 * audit log の action_type は RESERVATION_CANCEL。
 */
export async function cancelReservation(
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
  const updated = await db
    .update(schema.users)
    .set({ isDeleted: 1, updatedAt: params.now })
    .where(
      and(
        eq(schema.users.groupId, params.groupId),
        isNotNull(schema.users.reservedAt),
        isNull(schema.users.admittedAt),
        eq(schema.users.isDeleted, 0),
      ),
    )
    .returning({ groupId: schema.users.groupId });

  if (updated.length === 0) return;

  await db.insert(schema.operatorActions).values({
    id: actionId,
    operatorId: params.operatorId,
    groupId: params.groupId,
    actionType: "RESERVATION_CANCEL",
    fromStage: null,
    toStage: null,
    reasonCode: params.reasonCode,
    note: params.note,
    createdAt: params.now,
  });
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
