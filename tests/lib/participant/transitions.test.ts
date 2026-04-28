import { describe, it, expect } from "vitest";
import type { UserRow } from "~/lib/participant/types";
import {
  applyQ1Answer,
  applyQ1Checkpoint,
  applyQ2Answer,
  applyQ2Checkpoint,
  applyQ3Code,
  applyQ3Keyword,
  applyQ4Answer,
  startOrResume,
  TransitionError,
  unlockedSub,
} from "~/lib/participant/transitions";

const NOW = "2026-04-29T00:00:00.000Z";

function makeUser(overrides: Partial<UserRow> = {}): UserRow {
  return {
    groupId: "g_00000000-0000-4000-8000-000000000000",
    currentStage: "START",
    q1Order: null,
    q1_1Cleared: 0,
    q1_2Cleared: 0,
    q2Cleared: 0,
    startedAt: null,
    completedAt: null,
    reportedAt: null,
    epilogueViewedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe("startOrResume", () => {
  it("transitions START → Q1, assigns q1Order and emits events", () => {
    const user = makeUser();
    const { user: updated, events } = startOrResume(user, "Q1_1_FIRST", NOW);

    expect(updated.currentStage).toBe("Q1");
    expect(updated.q1Order).toBe("Q1_1_FIRST");
    expect(updated.startedAt).toBe(NOW);
    expect(events).toEqual([
      { type: "Q1_ORDER_ASSIGNED", order: "Q1_1_FIRST" },
      { type: "STAGE_TRANSITION", from: "START", to: "Q1" },
    ]);
  });

  it("does not re-assign q1Order on resume (idempotent)", () => {
    const user = makeUser({ currentStage: "Q1", q1Order: "Q1_2_FIRST" });
    const { user: updated, events } = startOrResume(user, "Q1_1_FIRST", NOW);

    expect(updated.q1Order).toBe("Q1_2_FIRST");
    expect(updated.currentStage).toBe("Q1");
    expect(events).toEqual([]);
  });
});

describe("unlockedSub", () => {
  it("returns Q1_1 first when order is Q1_1_FIRST", () => {
    expect(unlockedSub(makeUser({ q1Order: "Q1_1_FIRST" }))).toBe("Q1_1");
  });

  it("returns Q1_2 first when order is Q1_2_FIRST", () => {
    expect(unlockedSub(makeUser({ q1Order: "Q1_2_FIRST" }))).toBe("Q1_2");
  });

  it("returns the second sub when the first is cleared", () => {
    expect(
      unlockedSub(
        makeUser({ q1Order: "Q1_1_FIRST", q1_1Cleared: 1 }),
      ),
    ).toBe("Q1_2");
    expect(
      unlockedSub(
        makeUser({ q1Order: "Q1_2_FIRST", q1_2Cleared: 1 }),
      ),
    ).toBe("Q1_1");
  });

  it("returns null when both subs are cleared", () => {
    expect(
      unlockedSub(
        makeUser({
          q1Order: "Q1_1_FIRST",
          q1_1Cleared: 1,
          q1_2Cleared: 1,
        }),
      ),
    ).toBeNull();
  });
});

describe("applyQ1Answer", () => {
  const baseUser = makeUser({
    currentStage: "Q1",
    q1Order: "Q1_1_FIRST",
  });

  it("emits ANSWER_CORRECT but does NOT change state on correct answer", () => {
    const { user, events } = applyQ1Answer(baseUser, "Q1_1", true, NOW);
    expect(user).toBe(baseUser); // identical reference, no mutation
    expect(events).toEqual([{ type: "ANSWER_CORRECT", stage: "Q1_1" }]);
  });

  it("emits ANSWER_INCORRECT on wrong answer", () => {
    const { events } = applyQ1Answer(baseUser, "Q1_1", false, NOW);
    expect(events).toEqual([{ type: "ANSWER_INCORRECT", stage: "Q1_1" }]);
  });

  it("rejects answers for the locked sub-question", () => {
    expect(() => applyQ1Answer(baseUser, "Q1_2", true, NOW)).toThrow(
      TransitionError,
    );
  });

  it("rejects when current stage is not Q1", () => {
    const startUser = makeUser({ currentStage: "START", q1Order: null });
    expect(() => applyQ1Answer(startUser, "Q1_1", true, NOW)).toThrow(
      TransitionError,
    );
  });
});

describe("applyQ1Checkpoint", () => {
  const baseUser = makeUser({
    currentStage: "Q1",
    q1Order: "Q1_1_FIRST",
  });

  it("rejects when no correct answer has been recorded", () => {
    expect(() => applyQ1Checkpoint(baseUser, "Q1_1", false, NOW)).toThrow(
      TransitionError,
    );
  });

  it("clears the sub and stays on Q1 when only one sub is done", () => {
    const { user, events } = applyQ1Checkpoint(baseUser, "Q1_1", true, NOW);
    expect(user.q1_1Cleared).toBe(1);
    expect(user.q1_2Cleared).toBe(0);
    expect(user.currentStage).toBe("Q1");
    expect(events).toEqual([{ type: "CHECKPOINT_COMPLETED", stage: "Q1_1" }]);
  });

  it("transitions to Q2 when both subs are cleared", () => {
    const userAfterFirst = makeUser({
      currentStage: "Q1",
      q1Order: "Q1_1_FIRST",
      q1_1Cleared: 1,
    });
    const { user, events } = applyQ1Checkpoint(
      userAfterFirst,
      "Q1_2",
      true,
      NOW,
    );
    expect(user.q1_1Cleared).toBe(1);
    expect(user.q1_2Cleared).toBe(1);
    expect(user.currentStage).toBe("Q2");
    expect(events).toEqual([
      { type: "CHECKPOINT_COMPLETED", stage: "Q1_2" },
      { type: "STAGE_TRANSITION", from: "Q1", to: "Q2" },
    ]);
  });

  it("rejects checkpoint for the locked sub", () => {
    // Q1_1_FIRST: Q1_2 is locked first
    expect(() => applyQ1Checkpoint(baseUser, "Q1_2", true, NOW)).toThrow(
      TransitionError,
    );
  });
});

describe("applyQ2Answer", () => {
  it("emits ANSWER_CORRECT without state mutation on correct", () => {
    const user = makeUser({ currentStage: "Q2", q1Order: "Q1_1_FIRST" });
    const { user: out, events } = applyQ2Answer(user, true, NOW);
    expect(out).toBe(user);
    expect(events).toEqual([{ type: "ANSWER_CORRECT", stage: "Q2" }]);
  });

  it("rejects when current stage is not Q2", () => {
    const user = makeUser({ currentStage: "Q1", q1Order: "Q1_1_FIRST" });
    expect(() => applyQ2Answer(user, true, NOW)).toThrow(TransitionError);
  });
});

describe("applyQ2Checkpoint", () => {
  const baseUser = makeUser({ currentStage: "Q2", q1Order: "Q1_1_FIRST", q1_1Cleared: 1, q1_2Cleared: 1 });

  it("rejects when no correct answer recorded", () => {
    expect(() => applyQ2Checkpoint(baseUser, false, NOW)).toThrow(TransitionError);
  });

  it("transitions Q2 → Q3_KEYWORD on success", () => {
    const { user, events } = applyQ2Checkpoint(baseUser, true, NOW);
    expect(user.q2Cleared).toBe(1);
    expect(user.currentStage).toBe("Q3_KEYWORD");
    expect(events).toEqual([
      { type: "CHECKPOINT_COMPLETED", stage: "Q2" },
      { type: "STAGE_TRANSITION", from: "Q2", to: "Q3_KEYWORD" },
    ]);
  });
});

describe("applyQ3Keyword", () => {
  const baseUser = makeUser({ currentStage: "Q3_KEYWORD", q1Order: "Q1_1_FIRST" });

  it("transitions Q3_KEYWORD → Q3_CODE on correct", () => {
    const { user, events } = applyQ3Keyword(baseUser, true, NOW);
    expect(user.currentStage).toBe("Q3_CODE");
    expect(events).toEqual([
      { type: "ANSWER_CORRECT", stage: "Q3_KEYWORD" },
      { type: "STAGE_TRANSITION", from: "Q3_KEYWORD", to: "Q3_CODE" },
    ]);
  });

  it("stays on Q3_KEYWORD on incorrect", () => {
    const { user, events } = applyQ3Keyword(baseUser, false, NOW);
    expect(user).toBe(baseUser);
    expect(events).toEqual([{ type: "ANSWER_INCORRECT", stage: "Q3_KEYWORD" }]);
  });

  it("rejects when current stage is not Q3_KEYWORD", () => {
    const user = makeUser({ currentStage: "Q2", q1Order: "Q1_1_FIRST" });
    expect(() => applyQ3Keyword(user, true, NOW)).toThrow(TransitionError);
  });
});

describe("applyQ3Code", () => {
  const baseUser = makeUser({ currentStage: "Q3_CODE", q1Order: "Q1_1_FIRST" });

  it("transitions Q3_CODE → Q4 on correct", () => {
    const { user, events } = applyQ3Code(baseUser, true, NOW);
    expect(user.currentStage).toBe("Q4");
    expect(events).toEqual([
      { type: "ANSWER_CORRECT", stage: "Q3_CODE" },
      { type: "STAGE_TRANSITION", from: "Q3_CODE", to: "Q4" },
    ]);
  });

  it("stays on Q3_CODE on incorrect", () => {
    const { events } = applyQ3Code(baseUser, false, NOW);
    expect(events).toEqual([{ type: "ANSWER_INCORRECT", stage: "Q3_CODE" }]);
  });
});

describe("applyQ4Answer", () => {
  const baseUser = makeUser({ currentStage: "Q4", q1Order: "Q1_1_FIRST" });

  it("transitions Q4 → FAKE_END on correct", () => {
    const { user, events } = applyQ4Answer(baseUser, true, NOW);
    expect(user.currentStage).toBe("FAKE_END");
    expect(events).toEqual([
      { type: "ANSWER_CORRECT", stage: "Q4" },
      { type: "STAGE_TRANSITION", from: "Q4", to: "FAKE_END" },
    ]);
  });

  it("stays on Q4 on incorrect", () => {
    const { events } = applyQ4Answer(baseUser, false, NOW);
    expect(events).toEqual([{ type: "ANSWER_INCORRECT", stage: "Q4" }]);
  });

  it("rejects when current stage is not Q4", () => {
    const user = makeUser({ currentStage: "Q3_CODE", q1Order: "Q1_1_FIRST" });
    expect(() => applyQ4Answer(user, true, NOW)).toThrow(TransitionError);
  });
});
