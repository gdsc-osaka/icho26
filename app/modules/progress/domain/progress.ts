import type { CurrentStage, Q1Order, SubQuestion } from "./stage";

export interface Progress {
  readonly groupId: string;
  readonly currentStage: CurrentStage;
  readonly stateVersion: number;
  readonly q1Order: Q1Order | null;
  readonly currentUnlockedSubquestion: SubQuestion | null;
  readonly q1_1Completed: boolean;
  readonly q1_2Completed: boolean;
  readonly q2Completed: boolean;
  readonly q3KeywordCompleted: boolean;
  readonly q3CodeCompleted: boolean;
  readonly q4Completed: boolean;
  readonly reported: boolean;
  readonly startedAt: Date | null;
  readonly completedAt: Date | null;
  readonly reportedAt: Date | null;
  readonly epilogueViewedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
