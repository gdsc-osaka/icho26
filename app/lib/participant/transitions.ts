import type { ProgressEvent, Q1Order, SubQuestion, UserRow } from "./types";

/**
 * Domain error for invalid stage transitions or pre-condition failures.
 * The route handler converts this into an appropriate redirect.
 */
export class TransitionError extends Error {
  constructor(
    public readonly code:
      | "INVALID_STAGE"
      | "LOCKED_SUB"
      | "MISSING_ANSWER"
      | "ALREADY_CLEARED",
    message: string,
  ) {
    super(message);
    this.name = "TransitionError";
  }
}

/**
 * Determine which Q1 sub-question is currently unlocked for input.
 * Returns null when both subs are already cleared, or q1Order is unset.
 */
export function unlockedSub(user: UserRow): SubQuestion | null {
  if (user.q1_1Cleared && user.q1_2Cleared) return null;
  if (!user.q1Order) return null;
  if (user.q1Order === "Q1_1_FIRST") {
    return user.q1_1Cleared ? "Q1_2" : "Q1_1";
  }
  return user.q1_2Cleared ? "Q1_1" : "Q1_2";
}

/**
 * Initialize a fresh session or no-op for a returning participant.
 * `q1OrderForFresh` is consulted only when this is the first call
 * (`currentStage === 'START'` and `q1Order === null`); resumes ignore it
 * so the original assignment is preserved.
 */
export function startOrResume(
  user: UserRow,
  q1OrderForFresh: Q1Order,
  now: string,
): { user: UserRow; events: ProgressEvent[] } {
  if (user.currentStage !== "START" || user.q1Order !== null) {
    // Already started — resume idempotently with no state mutation.
    return { user, events: [] };
  }

  const updated: UserRow = {
    ...user,
    currentStage: "Q1",
    q1Order: q1OrderForFresh,
    startedAt: now,
    updatedAt: now,
  };

  const events: ProgressEvent[] = [
    { type: "Q1_ORDER_ASSIGNED", order: q1OrderForFresh },
    { type: "STAGE_TRANSITION", from: "START", to: "Q1" },
  ];

  return { user: updated, events };
}

/**
 * Validate a Q1 sub-question answer submission.
 *
 * Important: per spec 03 §4.4 ("Q1 のサブ問題完了はサブ回答 + checkpoint の両方が必要")
 * a correct answer alone does NOT clear the sub. This function therefore
 * never mutates the user state — it only validates pre-conditions and signals
 * the answer outcome via events. The route action records the attempt to
 * `attempt_logs`; the eventual cleared flag is set by `applyQ1Checkpoint`.
 */
export function applyQ1Answer(
  user: UserRow,
  sub: SubQuestion,
  correct: boolean,
  _now: string,
): { user: UserRow; events: ProgressEvent[] } {
  if (user.currentStage !== "Q1") {
    throw new TransitionError(
      "INVALID_STAGE",
      `Q1 answer rejected: current stage is ${user.currentStage}`,
    );
  }
  const expected = unlockedSub(user);
  if (expected === null || expected !== sub) {
    throw new TransitionError(
      "LOCKED_SUB",
      `${sub} is not the currently unlocked sub-question`,
    );
  }

  return {
    user,
    events: [
      {
        type: correct ? "ANSWER_CORRECT" : "ANSWER_INCORRECT",
        stage: sub,
      },
    ],
  };
}

/**
 * Apply a Q1 sub-question checkpoint visit. Sets the cleared flag for the
 * sub, and transitions to Q2 when both subs are cleared.
 *
 * Caller is responsible for verifying that:
 *   - the checkpoint code is valid for this sub (`getCheckpointCode`)
 *   - the participant has a correct answer recorded for this sub
 *     (`hasCorrectAnswer`, computed by querying `attempt_logs`)
 */
export function applyQ1Checkpoint(
  user: UserRow,
  sub: SubQuestion,
  hasCorrectAnswer: boolean,
  now: string,
): { user: UserRow; events: ProgressEvent[] } {
  if (user.currentStage !== "Q1") {
    throw new TransitionError(
      "INVALID_STAGE",
      `Q1 checkpoint rejected: current stage is ${user.currentStage}`,
    );
  }
  const expected = unlockedSub(user);
  if (expected === null || expected !== sub) {
    throw new TransitionError(
      "LOCKED_SUB",
      `${sub} is not the currently unlocked sub-question`,
    );
  }
  if (!hasCorrectAnswer) {
    throw new TransitionError(
      "MISSING_ANSWER",
      `${sub} checkpoint requires a prior correct answer`,
    );
  }

  const q1_1Cleared = sub === "Q1_1" ? 1 : user.q1_1Cleared;
  const q1_2Cleared = sub === "Q1_2" ? 1 : user.q1_2Cleared;
  const bothCleared = q1_1Cleared === 1 && q1_2Cleared === 1;

  const updated: UserRow = {
    ...user,
    q1_1Cleared,
    q1_2Cleared,
    currentStage: bothCleared ? "Q2" : user.currentStage,
    updatedAt: now,
  };

  const events: ProgressEvent[] = [
    { type: "CHECKPOINT_COMPLETED", stage: sub },
  ];
  if (bothCleared) {
    events.push({ type: "STAGE_TRANSITION", from: "Q1", to: "Q2" });
  }

  return { user: updated, events };
}

/**
 * Validate a Q2 answer submission. Same gated semantics as Q1: a correct
 * answer alone does not advance state — checkpoint visit is required.
 */
export function applyQ2Answer(
  user: UserRow,
  correct: boolean,
  _now: string,
): { user: UserRow; events: ProgressEvent[] } {
  if (user.currentStage !== "Q2") {
    throw new TransitionError(
      "INVALID_STAGE",
      `Q2 answer rejected: current stage is ${user.currentStage}`,
    );
  }
  return {
    user,
    events: [
      {
        type: correct ? "ANSWER_CORRECT" : "ANSWER_INCORRECT",
        stage: "Q2",
      },
    ],
  };
}

/**
 * Apply a Q2 checkpoint visit. Sets `q2Cleared` and transitions to
 * `Q3_KEYWORD`. Caller verifies the checkpoint code and prior correct answer.
 */
export function applyQ2Checkpoint(
  user: UserRow,
  hasCorrectAnswer: boolean,
  now: string,
): { user: UserRow; events: ProgressEvent[] } {
  if (user.currentStage !== "Q2") {
    throw new TransitionError(
      "INVALID_STAGE",
      `Q2 checkpoint rejected: current stage is ${user.currentStage}`,
    );
  }
  if (!hasCorrectAnswer) {
    throw new TransitionError(
      "MISSING_ANSWER",
      "Q2 checkpoint requires a prior correct answer",
    );
  }

  const updated: UserRow = {
    ...user,
    q2Cleared: 1,
    currentStage: "Q3_KEYWORD",
    updatedAt: now,
  };

  return {
    user: updated,
    events: [
      { type: "CHECKPOINT_COMPLETED", stage: "Q2" },
      { type: "STAGE_TRANSITION", from: "Q2", to: "Q3_KEYWORD" },
    ],
  };
}

/**
 * Apply a Q3 keyword submission. Correct → transition to `Q3_CODE`.
 * Q3 has no physical checkpoint — the in-room exploration itself is the
 * gate, so the answer alone advances state.
 */
export function applyQ3Keyword(
  user: UserRow,
  correct: boolean,
  now: string,
): { user: UserRow; events: ProgressEvent[] } {
  if (user.currentStage !== "Q3_KEYWORD") {
    throw new TransitionError(
      "INVALID_STAGE",
      `Q3 keyword rejected: current stage is ${user.currentStage}`,
    );
  }
  if (!correct) {
    return {
      user,
      events: [{ type: "ANSWER_INCORRECT", stage: "Q3_KEYWORD" }],
    };
  }
  const updated: UserRow = {
    ...user,
    currentStage: "Q3_CODE",
    updatedAt: now,
  };
  return {
    user: updated,
    events: [
      { type: "ANSWER_CORRECT", stage: "Q3_KEYWORD" },
      { type: "STAGE_TRANSITION", from: "Q3_KEYWORD", to: "Q3_CODE" },
    ],
  };
}

/**
 * Apply a Q3 numeric code submission. Correct → transition to `Q4`.
 */
export function applyQ3Code(
  user: UserRow,
  correct: boolean,
  now: string,
): { user: UserRow; events: ProgressEvent[] } {
  if (user.currentStage !== "Q3_CODE") {
    throw new TransitionError(
      "INVALID_STAGE",
      `Q3 code rejected: current stage is ${user.currentStage}`,
    );
  }
  if (!correct) {
    return {
      user,
      events: [{ type: "ANSWER_INCORRECT", stage: "Q3_CODE" }],
    };
  }
  const updated: UserRow = {
    ...user,
    currentStage: "Q4",
    updatedAt: now,
  };
  return {
    user: updated,
    events: [
      { type: "ANSWER_CORRECT", stage: "Q3_CODE" },
      { type: "STAGE_TRANSITION", from: "Q3_CODE", to: "Q4" },
    ],
  };
}

/**
 * Mark the epilogue as viewed. Transitions `FAKE_END` → `COMPLETE` and
 * stamps `epilogueViewedAt` + `completedAt`. Idempotent: if the user has
 * already viewed the epilogue, returns the user unchanged with no events.
 */
export function markEpilogueViewed(
  user: UserRow,
  now: string,
): { user: UserRow; events: ProgressEvent[] } {
  if (user.currentStage === "COMPLETE") {
    // Already viewed — no-op, keeps re-visits cheap.
    return { user, events: [] };
  }
  if (user.currentStage !== "FAKE_END") {
    throw new TransitionError(
      "INVALID_STAGE",
      `Epilogue rejected: current stage is ${user.currentStage}`,
    );
  }
  const updated: UserRow = {
    ...user,
    currentStage: "COMPLETE",
    epilogueViewedAt: now,
    completedAt: user.completedAt ?? now,
    updatedAt: now,
  };
  return {
    user: updated,
    events: [
      { type: "EPILOGUE_VIEWED" },
      { type: "STAGE_TRANSITION", from: "FAKE_END", to: "COMPLETE" },
    ],
  };
}

/**
 * Apply a Q4 answer submission. Correct → transition to `FAKE_END`.
 */
export function applyQ4Answer(
  user: UserRow,
  correct: boolean,
  now: string,
): { user: UserRow; events: ProgressEvent[] } {
  if (user.currentStage !== "Q4") {
    throw new TransitionError(
      "INVALID_STAGE",
      `Q4 answer rejected: current stage is ${user.currentStage}`,
    );
  }
  if (!correct) {
    return {
      user,
      events: [{ type: "ANSWER_INCORRECT", stage: "Q4" }],
    };
  }
  const updated: UserRow = {
    ...user,
    currentStage: "FAKE_END",
    updatedAt: now,
  };
  return {
    user: updated,
    events: [
      { type: "ANSWER_CORRECT", stage: "Q4" },
      { type: "STAGE_TRANSITION", from: "Q4", to: "FAKE_END" },
    ],
  };
}
