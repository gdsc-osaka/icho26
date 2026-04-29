import { desc, eq, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../../../db/schema";
import type { Stage } from "../../../db/schema";

export type DashboardRow = {
  groupId: string;
  currentStage: Stage;
  groupName: string | null;
  groupSize: number | null;
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
      groupName: schema.users.groupName,
      groupSize: schema.users.groupSize,
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
    groupName: u.groupName,
    groupSize: u.groupSize,
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

export type UserDetail = {
  user: typeof schema.users.$inferSelect;
  attempts: (typeof schema.attemptLogs.$inferSelect)[];
  progress: (typeof schema.progressLogs.$inferSelect)[];
  actions: (typeof schema.operatorActions.$inferSelect)[];
};

export async function getUserDetail(
  db: DrizzleD1Database<typeof schema>,
  groupId: string,
): Promise<UserDetail | null> {
  const userRows = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.groupId, groupId))
    .limit(1);

  const user = userRows[0];
  if (!user) return null;

  const [attempts, progress, actions] = await Promise.all([
    db
      .select()
      .from(schema.attemptLogs)
      .where(eq(schema.attemptLogs.groupId, groupId))
      .orderBy(desc(schema.attemptLogs.createdAt)),
    db
      .select()
      .from(schema.progressLogs)
      .where(eq(schema.progressLogs.groupId, groupId))
      .orderBy(desc(schema.progressLogs.createdAt)),
    db
      .select()
      .from(schema.operatorActions)
      .where(eq(schema.operatorActions.groupId, groupId))
      .orderBy(desc(schema.operatorActions.createdAt)),
  ]);

  return { user, attempts, progress, actions };
}
