import { eq } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { attemptLogs, progressLogs, users } from "../../../db/schema";
import type {
  AttemptLogRow,
  ProgressEvent,
  ProgressLogRow,
  UserRow,
} from "./types";

// `createUser` lives in `~/lib/shared/users.ts` — both participant /start and
// operator dashboard share the same insertion path.

function eventToProgressLog(
  groupId: string,
  ev: ProgressEvent,
  now: string,
): ProgressLogRow | null {
  const id = crypto.randomUUID();
  switch (ev.type) {
    case "Q1_ORDER_ASSIGNED":
      return {
        id,
        groupId,
        eventType: "Q1_ORDER_ASSIGNED",
        fromStage: null,
        toStage: null,
        detail: JSON.stringify({ order: ev.order }),
        createdAt: now,
      };
    case "STAGE_TRANSITION":
      return {
        id,
        groupId,
        eventType: "STAGE_TRANSITION",
        fromStage: ev.from,
        toStage: ev.to,
        detail: null,
        createdAt: now,
      };
    case "CHECKPOINT_COMPLETED":
      return {
        id,
        groupId,
        eventType: "CHECKPOINT_COMPLETED",
        fromStage: null,
        toStage: null,
        detail: JSON.stringify({ stage: ev.stage }),
        createdAt: now,
      };
    case "EPILOGUE_VIEWED":
      return {
        id,
        groupId,
        eventType: "EPILOGUE_VIEWED",
        fromStage: null,
        toStage: null,
        detail: null,
        createdAt: now,
      };
    case "ANSWER_CORRECT":
    case "ANSWER_INCORRECT":
      // not persisted to progress_logs (recorded in attempt_logs only)
      return null;
  }
}

/**
 * Persist a state transition atomically: update the `users` row, append
 * persistable events to `progress_logs`, and (optionally) record the
 * answer attempt to `attempt_logs`. Uses Cloudflare D1's batch API.
 */
export async function applyTransition(
  db: DrizzleD1Database,
  user: UserRow,
  events: ProgressEvent[],
  attemptLog: AttemptLogRow | null,
  now: string,
): Promise<void> {
  // Update the users row (createdAt is preserved by passing user spread).
  const userUpdate = db
    .update(users)
    .set({
      currentStage: user.currentStage,
      q1Order: user.q1Order,
      q1_1Cleared: user.q1_1Cleared,
      q1_2Cleared: user.q1_2Cleared,
      q2Cleared: user.q2Cleared,
      startedAt: user.startedAt,
      completedAt: user.completedAt,
      reportedAt: user.reportedAt,
      epilogueViewedAt: user.epilogueViewedAt,
      updatedAt: user.updatedAt,
    })
    .where(eq(users.groupId, user.groupId));

  const progressRows = events
    .map((ev) => eventToProgressLog(user.groupId, ev, now))
    .filter((r): r is ProgressLogRow => r !== null);

  // Cast each statement to BatchItem so TS accepts the heterogeneous tuple.
  const stmts: BatchItem<"sqlite">[] = [
    userUpdate as unknown as BatchItem<"sqlite">,
  ];
  if (progressRows.length > 0) {
    stmts.push(
      db
        .insert(progressLogs)
        .values(progressRows) as unknown as BatchItem<"sqlite">,
    );
  }
  if (attemptLog) {
    stmts.push(
      db
        .insert(attemptLogs)
        .values(attemptLog) as unknown as BatchItem<"sqlite">,
    );
  }

  await db.batch(stmts as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);
}
