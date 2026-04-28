import type {
  AnswerStage,
  Q1Order,
  Stage,
  SubQuestion,
  attemptLogs,
  progressLogs,
  users,
} from "../../../db/schema";

export type { Stage, Q1Order, SubQuestion, AnswerStage };

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
export type AttemptLogRow = typeof attemptLogs.$inferInsert;
export type ProgressLogRow = typeof progressLogs.$inferInsert;

export type ProgressEvent =
  | { type: "Q1_ORDER_ASSIGNED"; order: Q1Order }
  | { type: "STAGE_TRANSITION"; from: Stage; to: Stage }
  | { type: "ANSWER_CORRECT"; stage: AnswerStage }
  | { type: "ANSWER_INCORRECT"; stage: AnswerStage }
  | { type: "CHECKPOINT_COMPLETED"; stage: SubQuestion | "Q2" }
  | { type: "EPILOGUE_VIEWED" };
