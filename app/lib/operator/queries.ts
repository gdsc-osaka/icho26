import { and, desc, eq, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../../../db/schema";
import { STAGES, type Stage } from "../../../db/schema";

export type DashboardRow = {
  groupId: string;
  currentStage: Stage;
  groupName: string | null;
  groupSize: number | null;
  attemptCountTotal: number;
  reportedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
  createdAt: string;
};

export type ListUsersOpts = {
  /** 削除済みも含めるか。既定 false（有効レコードのみ）。 */
  includeDeleted?: boolean;
};

export async function listUsers(
  db: DrizzleD1Database<typeof schema>,
  opts: ListUsersOpts = {},
): Promise<DashboardRow[]> {
  const baseQuery = db
    .select({
      groupId: schema.users.groupId,
      currentStage: schema.users.currentStage,
      groupName: schema.users.groupName,
      groupSize: schema.users.groupSize,
      reportedAt: schema.users.reportedAt,
      startedAt: schema.users.startedAt,
      completedAt: schema.users.completedAt,
      updatedAt: schema.users.updatedAt,
      createdAt: schema.users.createdAt,
    })
    .from(schema.users);

  const userRows = await (opts.includeDeleted
    ? baseQuery.orderBy(desc(schema.users.updatedAt))
    : baseQuery
        .where(eq(schema.users.isDeleted, 0))
        .orderBy(desc(schema.users.updatedAt)));

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
    completedAt: u.completedAt,
    updatedAt: u.updatedAt,
    createdAt: u.createdAt,
  }));
}

export type StageBreakdown = Record<Stage, number>;

export type DashboardStats = {
  totalGroups: number;
  totalParticipants: number;
  startedGroups: number; // currentStage !== "START"
  completedGroups: number; // currentStage === "COMPLETE"
  reportedGroups: number;
  /** currentStage !== "START" かつ reportedAt === null の人数（参加者の合計人数）。 */
  activeUnreportedParticipants: number;
  /** currentStage !== "START" かつ reportedAt === null のグループ数。 */
  activeUnreportedGroups: number;
  totalAttempts: number;
  averageAttemptsPerGroup: number;
  stageBreakdown: StageBreakdown;
  hourlyStartedCounts: { hour: number; count: number }[]; // 0-23
};

export async function getStats(
  db: DrizzleD1Database<typeof schema>,
): Promise<DashboardStats> {
  const [users, attemptCountRow] = await Promise.all([
    db
      .select({
        groupSize: schema.users.groupSize,
        currentStage: schema.users.currentStage,
        startedAt: schema.users.startedAt,
        completedAt: schema.users.completedAt,
        reportedAt: schema.users.reportedAt,
      })
      .from(schema.users)
      .where(eq(schema.users.isDeleted, 0)),
    db
      .select({
        count: sql<number>`count(*)`.as("count"),
      })
      .from(schema.attemptLogs)
      .innerJoin(
        schema.users,
        eq(schema.attemptLogs.groupId, schema.users.groupId),
      )
      .where(eq(schema.users.isDeleted, 0)),
  ]);

  const stageBreakdown = STAGES.reduce<StageBreakdown>((acc, s) => {
    acc[s] = 0;
    return acc;
  }, {} as StageBreakdown);

  let totalParticipants = 0;
  let startedGroups = 0;
  let completedGroups = 0;
  let reportedGroups = 0;
  let activeUnreportedGroups = 0;
  let activeUnreportedParticipants = 0;
  const hourlyMap = new Map<number, number>();

  for (const u of users) {
    if (u.groupSize) totalParticipants += u.groupSize;
    const stage = u.currentStage as Stage;
    if (STAGES.includes(stage)) stageBreakdown[stage] += 1;
    if (stage !== "START") startedGroups += 1;
    if (stage === "COMPLETE") completedGroups += 1;
    if (u.reportedAt !== null) reportedGroups += 1;
    if (stage !== "START" && u.reportedAt === null) {
      activeUnreportedGroups += 1;
      if (u.groupSize) activeUnreportedParticipants += u.groupSize;
    }
    if (u.startedAt) {
      const hour = new Date(u.startedAt).getHours();
      hourlyMap.set(hour, (hourlyMap.get(hour) ?? 0) + 1);
    }
  }

  const totalAttempts = attemptCountRow[0]?.count ?? 0;
  const totalGroups = users.length;

  const hourlyStartedCounts = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    count: hourlyMap.get(hour) ?? 0,
  }));

  return {
    totalGroups,
    totalParticipants,
    startedGroups,
    completedGroups,
    reportedGroups,
    activeUnreportedGroups,
    activeUnreportedParticipants,
    totalAttempts,
    averageAttemptsPerGroup:
      totalGroups === 0 ? 0 : totalAttempts / totalGroups,
    stageBreakdown,
    hourlyStartedCounts,
  };
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
    .where(
      and(eq(schema.users.groupId, groupId), eq(schema.users.isDeleted, 0)),
    )
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
