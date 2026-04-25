import type { CurrentStage, SubQuestion } from "./stage";

export const DomainEventType = {
  SESSION_STARTED: "SESSION_STARTED",
  ANSWER_CORRECT: "ANSWER_CORRECT",
  ANSWER_INCORRECT: "ANSWER_INCORRECT",
  CHECKPOINT_COMPLETED: "CHECKPOINT_COMPLETED",
  STAGE_TRANSITION: "STAGE_TRANSITION",
  SUBQUESTION_UNLOCKED: "SUBQUESTION_UNLOCKED",
  EPILOGUE_VIEWED: "EPILOGUE_VIEWED",
} as const;

export type DomainEventType =
  (typeof DomainEventType)[keyof typeof DomainEventType];

export type DomainEvent =
  | { type: "SESSION_STARTED"; q1Order: string; firstSubquestion: SubQuestion }
  | { type: "ANSWER_CORRECT"; stage: string }
  | { type: "ANSWER_INCORRECT"; stage: string }
  | { type: "CHECKPOINT_COMPLETED"; stage: string }
  | { type: "STAGE_TRANSITION"; fromStage: CurrentStage; toStage: CurrentStage }
  | { type: "SUBQUESTION_UNLOCKED"; subQuestion: SubQuestion }
  | { type: "EPILOGUE_VIEWED" };
