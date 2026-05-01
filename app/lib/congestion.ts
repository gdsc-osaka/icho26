import { and, eq, count, isNotNull } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { users } from "../../db/schema";

export const CONGESTION_CAPACITY = 30;

export type CongestionSnapshot = {
  activeParticipants: number;
  capacity: number;
  /** 0..1, capped at 1 even when activeParticipants > capacity. */
  rate: number;
  overCapacity: boolean;
};

export function buildCongestionSnapshot(
  activeParticipants: number,
  capacity: number = CONGESTION_CAPACITY,
): CongestionSnapshot {
  const safe = Math.max(0, activeParticipants);
  return {
    activeParticipants: safe,
    capacity,
    rate: capacity === 0 ? 0 : Math.min(1, safe / capacity),
    overCapacity: safe > capacity,
  };
}

export async function countActiveParticipants(
  db: DrizzleD1Database,
): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(users)
    .where(and(isNotNull(users.reportedAt), eq(users.isDeleted, 0)));
  return Number(row?.total ?? 0);
}
