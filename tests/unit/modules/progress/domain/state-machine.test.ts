import { describe, it, expect } from "vitest";
import {
  confirmQ1Checkpoint,
  confirmQ2Checkpoint,
  markEpilogueViewed,
  startOrResumeSession,
  submitQ1Answer,
  submitQ2Answer,
  submitQ3Code,
  submitQ3Keyword,
  submitQ4Answer,
} from "~/modules/progress/domain/state-machine";
import { DomainErrorCode } from "~/modules/progress/domain/errors";
import {
  CheckpointMethod,
  CurrentStage,
  Q1Order,
  SubQuestion,
} from "~/modules/progress/domain/stage";
import type { Progress } from "~/modules/progress/domain/progress";

const NOW = new Date("2026-04-24T10:00:00.000Z");

function baseUser(overrides: Partial<Progress> = {}): Progress {
  return {
    groupId: "g_00000000-0000-4000-8000-000000000000",
    currentStage: CurrentStage.START,
    stateVersion: 0,
    q1Order: null,
    currentUnlockedSubquestion: null,
    q1_1Completed: false,
    q1_2Completed: false,
    q2Completed: false,
    q3KeywordCompleted: false,
    q3CodeCompleted: false,
    q4Completed: false,
    reported: false,
    startedAt: null,
    completedAt: null,
    reportedAt: null,
    epilogueViewedAt: null,
    createdAt: new Date("2026-04-24T09:00:00.000Z"),
    updatedAt: new Date("2026-04-24T09:00:00.000Z"),
    ...overrides,
  };
}

describe("state-machine: startOrResumeSession", () => {
  it("transitions START → Q1 with Q1 order assigned and startedAt set", () => {
    const r = startOrResumeSession(baseUser(), {
      now: NOW,
      randomQ1Order: Q1Order.Q1_1_FIRST,
    });
    if (!r.ok) throw new Error("expected Ok");
    expect(r.value.progress.currentStage).toBe(CurrentStage.Q1);
    expect(r.value.progress.q1Order).toBe(Q1Order.Q1_1_FIRST);
    expect(r.value.progress.currentUnlockedSubquestion).toBe(SubQuestion.Q1_1);
    expect(r.value.progress.startedAt).toEqual(NOW);
    expect(r.value.progress.stateVersion).toBe(1);
    expect(r.value.events.map((e) => e.type)).toContain("SESSION_STARTED");
  });

  it("does not re-randomize q1Order when resuming an existing session", () => {
    const user = baseUser({
      currentStage: CurrentStage.Q1,
      q1Order: Q1Order.Q1_2_FIRST,
      currentUnlockedSubquestion: SubQuestion.Q1_2,
      startedAt: new Date("2026-04-24T09:30:00.000Z"),
    });
    const r = startOrResumeSession(user, { now: NOW });
    if (!r.ok) throw new Error("expected Ok");
    expect(r.value.progress.q1Order).toBe(Q1Order.Q1_2_FIRST);
    expect(r.value.progress.currentUnlockedSubquestion).toBe(SubQuestion.Q1_2);
    expect(r.value.events).toEqual([]);
  });
});

describe("state-machine: Q1 answer/checkpoint", () => {
  const q1User = (unlocked: SubQuestion) =>
    baseUser({
      currentStage: CurrentStage.Q1,
      q1Order: Q1Order.Q1_1_FIRST,
      currentUnlockedSubquestion: unlocked,
      startedAt: new Date("2026-04-24T09:30:00.000Z"),
    });

  it("rejects Q1 answer from non-Q1 stage with INVALID_STAGE_TRANSITION", () => {
    const r = submitQ1Answer(baseUser(), SubQuestion.Q1_1, "42", { now: NOW });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe(DomainErrorCode.INVALID_STAGE_TRANSITION);
  });

  it("rejects answer to a locked subquestion with SUBQUESTION_NOT_UNLOCKED", () => {
    const r = submitQ1Answer(q1User(SubQuestion.Q1_1), SubQuestion.Q1_2, "7", {
      now: NOW,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe(DomainErrorCode.SUBQUESTION_NOT_UNLOCKED);
  });

  it("correct answer keeps user in Q1 (stage advance requires checkpoint)", () => {
    const r = submitQ1Answer(q1User(SubQuestion.Q1_1), SubQuestion.Q1_1, "42", {
      now: NOW,
    });
    if (!r.ok) throw new Error("expected Ok");
    expect(r.value.progress.currentStage).toBe(CurrentStage.Q1);
    expect(r.value.events.some((e) => e.type === "ANSWER_CORRECT")).toBe(true);
  });

  it("completing first subquestion's checkpoint unlocks the other subquestion", () => {
    const r = confirmQ1Checkpoint(
      q1User(SubQuestion.Q1_1),
      SubQuestion.Q1_1,
      "CP-Q1-1-ALPHA",
      CheckpointMethod.QR,
      { now: NOW }
    );
    if (!r.ok) throw new Error("expected Ok");
    expect(r.value.progress.currentStage).toBe(CurrentStage.Q1);
    expect(r.value.progress.q1_1Completed).toBe(true);
    expect(r.value.progress.q1_2Completed).toBe(false);
    expect(r.value.progress.currentUnlockedSubquestion).toBe(SubQuestion.Q1_2);
  });

  it("completing both checkpoints transitions Q1 → Q2", () => {
    const afterFirst = confirmQ1Checkpoint(
      q1User(SubQuestion.Q1_1),
      SubQuestion.Q1_1,
      "CP-Q1-1-ALPHA",
      CheckpointMethod.QR,
      { now: NOW }
    );
    if (!afterFirst.ok) throw new Error("expected Ok");

    const afterSecond = confirmQ1Checkpoint(
      afterFirst.value.progress,
      SubQuestion.Q1_2,
      "CP-Q1-2-BRAVO",
      CheckpointMethod.QR,
      { now: NOW }
    );
    if (!afterSecond.ok) throw new Error("expected Ok");
    expect(afterSecond.value.progress.currentStage).toBe(CurrentStage.Q2);
    expect(afterSecond.value.progress.currentUnlockedSubquestion).toBe(null);
  });

  it("rejects Q1 checkpoint with empty code as INVALID_CHECKPOINT_CODE", () => {
    const r = confirmQ1Checkpoint(
      q1User(SubQuestion.Q1_1),
      SubQuestion.Q1_1,
      "",
      CheckpointMethod.QR,
      { now: NOW }
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe(DomainErrorCode.INVALID_CHECKPOINT_CODE);
  });
});

describe("state-machine: Q2 → Q3 → Q4 → FAKE_END", () => {
  it("Q2 correct answer stays in Q2 (advance requires checkpoint)", () => {
    const user = baseUser({ currentStage: CurrentStage.Q2, stateVersion: 5 });
    const r = submitQ2Answer(user, "coffeecup", { now: NOW });
    if (!r.ok) throw new Error("expected Ok");
    expect(r.value.progress.currentStage).toBe(CurrentStage.Q2);
  });

  it("Q2 checkpoint transitions Q2 → Q3_KEYWORD", () => {
    const user = baseUser({ currentStage: CurrentStage.Q2 });
    const r = confirmQ2Checkpoint(user, "CP-Q2-CHARLIE", CheckpointMethod.QR, {
      now: NOW,
    });
    if (!r.ok) throw new Error("expected Ok");
    expect(r.value.progress.currentStage).toBe(CurrentStage.Q3_KEYWORD);
    expect(r.value.progress.q2Completed).toBe(true);
  });

  it("Q3 keyword correct → Q3_CODE", () => {
    const user = baseUser({ currentStage: CurrentStage.Q3_KEYWORD });
    const r = submitQ3Keyword(user, "hakidamenitsuru", { now: NOW });
    if (!r.ok) throw new Error("expected Ok");
    expect(r.value.progress.currentStage).toBe(CurrentStage.Q3_CODE);
  });

  it("Q3 code correct → Q4", () => {
    const user = baseUser({ currentStage: CurrentStage.Q3_CODE });
    const r = submitQ3Code(user, "2.24", { now: NOW });
    if (!r.ok) throw new Error("expected Ok");
    expect(r.value.progress.currentStage).toBe(CurrentStage.Q4);
  });

  it("Q4 correct → FAKE_END", () => {
    const user = baseUser({ currentStage: CurrentStage.Q4 });
    const r = submitQ4Answer(user, "29", { now: NOW });
    if (!r.ok) throw new Error("expected Ok");
    expect(r.value.progress.currentStage).toBe(CurrentStage.FAKE_END);
  });

  it("incorrect Q4 stays at Q4", () => {
    const user = baseUser({ currentStage: CurrentStage.Q4 });
    const r = submitQ4Answer(user, "30", { now: NOW });
    if (!r.ok) throw new Error("expected Ok");
    expect(r.value.progress.currentStage).toBe(CurrentStage.Q4);
  });
});

describe("state-machine: markEpilogueViewed", () => {
  it("is allowed only after FAKE_END", () => {
    const user = baseUser({ currentStage: CurrentStage.Q4 });
    const r = markEpilogueViewed(user, { now: NOW });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe(DomainErrorCode.EPILOGUE_NOT_ALLOWED);
  });

  it("transitions FAKE_END → COMPLETE and sets epilogueViewedAt", () => {
    const user = baseUser({ currentStage: CurrentStage.FAKE_END });
    const r = markEpilogueViewed(user, { now: NOW });
    if (!r.ok) throw new Error("expected Ok");
    expect(r.value.progress.currentStage).toBe(CurrentStage.COMPLETE);
    expect(r.value.progress.epilogueViewedAt).toEqual(NOW);
    expect(r.value.progress.completedAt).toEqual(NOW);
  });
});

describe("state-machine: invalid transitions return CONFLICT_STATE semantics", () => {
  it("submit Q2 while in START is INVALID_STAGE_TRANSITION", () => {
    const r = submitQ2Answer(baseUser(), "coffeecup", { now: NOW });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe(DomainErrorCode.INVALID_STAGE_TRANSITION);
  });

  it("confirm Q2 checkpoint while in Q1 is INVALID_STAGE_TRANSITION", () => {
    const user = baseUser({
      currentStage: CurrentStage.Q1,
      q1Order: Q1Order.Q1_1_FIRST,
      currentUnlockedSubquestion: SubQuestion.Q1_1,
    });
    const r = confirmQ2Checkpoint(user, "CP-Q2-CHARLIE", CheckpointMethod.QR, {
      now: NOW,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe(DomainErrorCode.INVALID_STAGE_TRANSITION);
  });
});
