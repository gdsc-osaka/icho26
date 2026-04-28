import { desc, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../../../db/schema";
import type { Stage } from "../../../db/schema";

export type DashboardRow = {
  groupId: string;
  currentStage: Stage;
  attemptCountTotal: number;
  reportedAt: string | null;
  startedAt: string | null;
  updatedAt: string;
};

export async function listUsers(
  db: DrizzleD1Database<typeof schema>,
): Promise<DashboardRow[]> {
  const userRows = await db
    .select({
      groupId: schema.users.groupId,
      currentStage: schema.users.currentStage,
      reportedAt: schema.users.reportedAt,
      startedAt: schema.users.startedAt,
      updatedAt: schema.users.updatedAt,
    })
    .from(schema.users)
    .orderBy(desc(schema.users.updatedAt));

  const counts = await db
    .select({
      groupId: schema.attemptLogs.groupId,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(schema.attemptLogs)
    .groupBy(schema.attemptLogs.groupId);

  const countMap = new Map(counts.map((c) => [c.groupId, c.count]));

  return userRows.map((u) => ({
    groupId: u.groupId,
    currentStage: u.currentStage as Stage,
    attemptCountTotal: countMap.get(u.groupId) ?? 0,
    reportedAt: u.reportedAt,
    startedAt: u.startedAt,
    updatedAt: u.updatedAt,
  }));
}

export async function getCredentials(
  db: DrizzleD1Database<typeof schema>,
): Promise<typeof schema.operatorCredentials.$inferSelect | null> {
  const rows = await db.select().from(schema.operatorCredentials).limit(1);
  return rows[0] ?? null;
}
