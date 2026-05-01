import { and, asc, eq, isNotNull, isNull } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../../../db/schema";
import { users } from "../../../db/schema";

export const RESERVATION_SLOT_MINUTES = 30;

export type WaitingReservation = {
  groupId: string;
  groupName: string | null;
  groupSize: number | null;
  reservedAt: string;
  position: number;
  estimatedStartAt: string;
};

export type ReservationStatus =
  | { kind: "none" }
  | {
      kind: "waiting";
      position: number;
      reservedAt: string;
      estimatedStartAt: string;
      slotMinutes: number;
    }
  | { kind: "admitted"; admittedAt: string };

/**
 * Compute the displayed start time for a reservation.
 *
 * Anchored at `reservedAt + (position - 1) * slot` and clamped to `now` so the
 * page never shows a past time even if the participant scans late.
 */
export function computeEstimatedStartAt(
  reservedAt: string,
  position: number,
  now: string,
  slotMinutes: number = RESERVATION_SLOT_MINUTES,
): string {
  const reservedMs = Date.parse(reservedAt);
  const nowMs = Date.parse(now);
  const offsetMs = Math.max(0, position - 1) * slotMinutes * 60_000;
  const target = Math.max(reservedMs + offsetMs, nowMs);
  return new Date(target).toISOString();
}

function waitingFilter() {
  return and(
    eq(users.isDeleted, 0),
    eq(users.currentStage, "START"),
    isNotNull(users.reservedAt),
    isNull(users.admittedAt),
  );
}

export async function listWaitingReservations(
  db: DrizzleD1Database<typeof schema>,
  now: string,
): Promise<WaitingReservation[]> {
  const rows = await db
    .select({
      groupId: users.groupId,
      groupName: users.groupName,
      groupSize: users.groupSize,
      reservedAt: users.reservedAt,
    })
    .from(users)
    .where(waitingFilter())
    .orderBy(asc(users.reservedAt), asc(users.groupId));

  return rows.map((row, idx) => {
    const position = idx + 1;
    const reservedAt = row.reservedAt as string;
    return {
      groupId: row.groupId,
      groupName: row.groupName,
      groupSize: row.groupSize,
      reservedAt,
      position,
      estimatedStartAt: computeEstimatedStartAt(reservedAt, position, now),
    };
  });
}

/**
 * Returns the reservation status for a single group, computing its queue
 * position by counting earlier waiting groups.
 */
export async function getReservationStatus(
  db: DrizzleD1Database<typeof schema>,
  groupId: string,
  now: string,
): Promise<ReservationStatus> {
  const [row] = await db
    .select({
      reservedAt: users.reservedAt,
      admittedAt: users.admittedAt,
      currentStage: users.currentStage,
      isDeleted: users.isDeleted,
    })
    .from(users)
    .where(eq(users.groupId, groupId))
    .limit(1);

  if (!row || !row.reservedAt) return { kind: "none" };
  if (row.admittedAt) return { kind: "admitted", admittedAt: row.admittedAt };
  if (row.isDeleted === 1 || row.currentStage !== "START") {
    // Soft-deleted or already past START — treat as no reservation gating.
    return { kind: "none" };
  }

  const waiting = await listWaitingReservations(db, now);
  const idx = waiting.findIndex((r) => r.groupId === groupId);
  const position = idx >= 0 ? idx + 1 : 1;
  const estimatedStartAt = computeEstimatedStartAt(
    row.reservedAt,
    position,
    now,
  );
  return {
    kind: "waiting",
    position,
    reservedAt: row.reservedAt,
    estimatedStartAt,
    slotMinutes: RESERVATION_SLOT_MINUTES,
  };
}
