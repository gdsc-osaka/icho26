import type { Result } from "~/shared/result";
import { err, ok } from "~/shared/result";
import {
  isQ1AnswerCorrect,
  isQ2AnswerCorrect,
  isQ3CodeCorrect,
  isQ3KeywordCorrect,
  isQ4AnswerCorrect,
} from "./answer-judge";
import { DomainError, DomainErrorCode } from "./errors";
import type { DomainEvent } from "./events";
import type { Progress } from "./progress";
import {
  CheckpointMethod,
  CurrentStage,
  Q1Order,
  SubQuestion,
} from "./stage";

export interface TransitionContext {
  readonly now: Date;
  readonly randomQ1Order?: Q1Order;
}

export interface TransitionResult {
  readonly progress: Progress;
  readonly events: readonly DomainEvent[];
}

export type TransitionOutcome = Result<TransitionResult, DomainError>;

function domainErr(
  code: DomainErrorCode,
  message: string
): DomainError {
  return new DomainError(code, message);
}

function pickQ1Order(ctx: TransitionContext): Q1Order {
  if (ctx.randomQ1Order) return ctx.randomQ1Order;
  return Math.random() < 0.5 ? Q1Order.Q1_1_FIRST : Q1Order.Q1_2_FIRST;
}

function firstSubQuestion(order: Q1Order): SubQuestion {
  return order === Q1Order.Q1_1_FIRST ? SubQuestion.Q1_1 : SubQuestion.Q1_2;
}

function otherSubQuestion(sub: SubQuestion): SubQuestion {
  return sub === SubQuestion.Q1_1 ? SubQuestion.Q1_2 : SubQuestion.Q1_1;
}

export function startOrResumeSession(
  user: Progress,
  ctx: TransitionContext
): TransitionOutcome {
  // 既に開始済み → 現状維持で返す
  if (user.currentStage !== CurrentStage.START) {
    return ok({ progress: user, events: [] });
  }

  const order = user.q1Order ?? pickQ1Order(ctx);
  const first = firstSubQuestion(order);

  const next: Progress = {
    ...user,
    currentStage: CurrentStage.Q1,
    q1Order: order,
    currentUnlockedSubquestion: first,
    startedAt: user.startedAt ?? ctx.now,
    updatedAt: ctx.now,
    stateVersion: user.stateVersion + 1,
  };

  return ok({
    progress: next,
    events: [
      { type: "SESSION_STARTED", q1Order: order, firstSubquestion: first },
      {
        type: "STAGE_TRANSITION",
        fromStage: CurrentStage.START,
        toStage: CurrentStage.Q1,
      },
      { type: "SUBQUESTION_UNLOCKED", subQuestion: first },
    ],
  });
}

export function submitQ1Answer(
  user: Progress,
  subQuestion: SubQuestion,
  normalizedAnswer: string,
  ctx: TransitionContext
): TransitionOutcome {
  if (user.currentStage !== CurrentStage.Q1) {
    return err(
      domainErr(
        DomainErrorCode.INVALID_STAGE_TRANSITION,
        `cannot submit Q1 answer in stage ${user.currentStage}`
      )
    );
  }
  if (user.currentUnlockedSubquestion !== subQuestion) {
    return err(
      domainErr(
        DomainErrorCode.SUBQUESTION_NOT_UNLOCKED,
        `subquestion ${subQuestion} is not unlocked`
      )
    );
  }

  const alreadyDone =
    (subQuestion === SubQuestion.Q1_1 && user.q1_1Completed) ||
    (subQuestion === SubQuestion.Q1_2 && user.q1_2Completed);
  if (alreadyDone) {
    return err(
      domainErr(
        DomainErrorCode.INVALID_STAGE_TRANSITION,
        `subquestion ${subQuestion} already completed`
      )
    );
  }

  if (!isQ1AnswerCorrect(subQuestion, normalizedAnswer)) {
    return ok({
      progress: { ...user, updatedAt: ctx.now },
      events: [{ type: "ANSWER_INCORRECT", stage: subQuestion }],
    });
  }

  return ok({
    progress: { ...user, updatedAt: ctx.now },
    events: [{ type: "ANSWER_CORRECT", stage: subQuestion }],
  });
}

export function confirmQ1Checkpoint(
  user: Progress,
  subQuestion: SubQuestion,
  checkpointCode: string,
  method: CheckpointMethod,
  ctx: TransitionContext
): TransitionOutcome {
  if (user.currentStage !== CurrentStage.Q1) {
    return err(
      domainErr(
        DomainErrorCode.INVALID_STAGE_TRANSITION,
        `cannot confirm Q1 checkpoint in stage ${user.currentStage}`
      )
    );
  }
  if (!checkpointCode) {
    return err(
      domainErr(
        DomainErrorCode.INVALID_CHECKPOINT_CODE,
        "checkpoint code is required"
      )
    );
  }
  // method is accepted but not validated here; repository validates code binding to stage
  void method;

  const q1_1Completed =
    subQuestion === SubQuestion.Q1_1 ? true : user.q1_1Completed;
  const q1_2Completed =
    subQuestion === SubQuestion.Q1_2 ? true : user.q1_2Completed;

  const events: DomainEvent[] = [
    { type: "CHECKPOINT_COMPLETED", stage: subQuestion },
  ];

  // 両方完了 → Q2 へ
  if (q1_1Completed && q1_2Completed) {
    events.push({
      type: "STAGE_TRANSITION",
      fromStage: CurrentStage.Q1,
      toStage: CurrentStage.Q2,
    });
    return ok({
      progress: {
        ...user,
        q1_1Completed,
        q1_2Completed,
        currentStage: CurrentStage.Q2,
        currentUnlockedSubquestion: null,
        updatedAt: ctx.now,
        stateVersion: user.stateVersion + 1,
      },
      events,
    });
  }

  // 片方完了 → もう片方を解放
  const other = otherSubQuestion(subQuestion);
  events.push({ type: "SUBQUESTION_UNLOCKED", subQuestion: other });

  return ok({
    progress: {
      ...user,
      q1_1Completed,
      q1_2Completed,
      currentUnlockedSubquestion: other,
      updatedAt: ctx.now,
      stateVersion: user.stateVersion + 1,
    },
    events,
  });
}

export function submitQ2Answer(
  user: Progress,
  normalizedAnswer: string,
  ctx: TransitionContext
): TransitionOutcome {
  if (user.currentStage !== CurrentStage.Q2) {
    return err(
      domainErr(
        DomainErrorCode.INVALID_STAGE_TRANSITION,
        `cannot submit Q2 answer in stage ${user.currentStage}`
      )
    );
  }
  if (!isQ2AnswerCorrect(normalizedAnswer)) {
    return ok({
      progress: { ...user, updatedAt: ctx.now },
      events: [{ type: "ANSWER_INCORRECT", stage: "Q2" }],
    });
  }
  return ok({
    progress: { ...user, updatedAt: ctx.now },
    events: [{ type: "ANSWER_CORRECT", stage: "Q2" }],
  });
}

export function confirmQ2Checkpoint(
  user: Progress,
  checkpointCode: string,
  method: CheckpointMethod,
  ctx: TransitionContext
): TransitionOutcome {
  if (user.currentStage !== CurrentStage.Q2) {
    return err(
      domainErr(
        DomainErrorCode.INVALID_STAGE_TRANSITION,
        `cannot confirm Q2 checkpoint in stage ${user.currentStage}`
      )
    );
  }
  if (!checkpointCode) {
    return err(
      domainErr(
        DomainErrorCode.INVALID_CHECKPOINT_CODE,
        "checkpoint code is required"
      )
    );
  }
  void method;

  return ok({
    progress: {
      ...user,
      q2Completed: true,
      currentStage: CurrentStage.Q3_KEYWORD,
      updatedAt: ctx.now,
      stateVersion: user.stateVersion + 1,
    },
    events: [
      { type: "CHECKPOINT_COMPLETED", stage: "Q2" },
      {
        type: "STAGE_TRANSITION",
        fromStage: CurrentStage.Q2,
        toStage: CurrentStage.Q3_KEYWORD,
      },
    ],
  });
}

export function submitQ3Keyword(
  user: Progress,
  normalizedAnswer: string,
  ctx: TransitionContext
): TransitionOutcome {
  if (user.currentStage !== CurrentStage.Q3_KEYWORD) {
    return err(
      domainErr(
        DomainErrorCode.INVALID_STAGE_TRANSITION,
        `cannot submit Q3 keyword in stage ${user.currentStage}`
      )
    );
  }
  if (!isQ3KeywordCorrect(normalizedAnswer)) {
    return ok({
      progress: { ...user, updatedAt: ctx.now },
      events: [{ type: "ANSWER_INCORRECT", stage: "Q3_KEYWORD" }],
    });
  }
  return ok({
    progress: {
      ...user,
      q3KeywordCompleted: true,
      currentStage: CurrentStage.Q3_CODE,
      updatedAt: ctx.now,
      stateVersion: user.stateVersion + 1,
    },
    events: [
      { type: "ANSWER_CORRECT", stage: "Q3_KEYWORD" },
      {
        type: "STAGE_TRANSITION",
        fromStage: CurrentStage.Q3_KEYWORD,
        toStage: CurrentStage.Q3_CODE,
      },
    ],
  });
}

export function submitQ3Code(
  user: Progress,
  normalizedAnswer: string,
  ctx: TransitionContext
): TransitionOutcome {
  if (user.currentStage !== CurrentStage.Q3_CODE) {
    return err(
      domainErr(
        DomainErrorCode.INVALID_STAGE_TRANSITION,
        `cannot submit Q3 code in stage ${user.currentStage}`
      )
    );
  }
  if (!isQ3CodeCorrect(normalizedAnswer)) {
    return ok({
      progress: { ...user, updatedAt: ctx.now },
      events: [{ type: "ANSWER_INCORRECT", stage: "Q3_CODE" }],
    });
  }
  return ok({
    progress: {
      ...user,
      q3CodeCompleted: true,
      currentStage: CurrentStage.Q4,
      updatedAt: ctx.now,
      stateVersion: user.stateVersion + 1,
    },
    events: [
      { type: "ANSWER_CORRECT", stage: "Q3_CODE" },
      {
        type: "STAGE_TRANSITION",
        fromStage: CurrentStage.Q3_CODE,
        toStage: CurrentStage.Q4,
      },
    ],
  });
}

export function submitQ4Answer(
  user: Progress,
  normalizedAnswer: string,
  ctx: TransitionContext
): TransitionOutcome {
  if (user.currentStage !== CurrentStage.Q4) {
    return err(
      domainErr(
        DomainErrorCode.INVALID_STAGE_TRANSITION,
        `cannot submit Q4 answer in stage ${user.currentStage}`
      )
    );
  }
  if (!isQ4AnswerCorrect(normalizedAnswer)) {
    return ok({
      progress: { ...user, updatedAt: ctx.now },
      events: [{ type: "ANSWER_INCORRECT", stage: "Q4" }],
    });
  }
  return ok({
    progress: {
      ...user,
      q4Completed: true,
      currentStage: CurrentStage.FAKE_END,
      updatedAt: ctx.now,
      stateVersion: user.stateVersion + 1,
    },
    events: [
      { type: "ANSWER_CORRECT", stage: "Q4" },
      {
        type: "STAGE_TRANSITION",
        fromStage: CurrentStage.Q4,
        toStage: CurrentStage.FAKE_END,
      },
    ],
  });
}

export function markEpilogueViewed(
  user: Progress,
  ctx: TransitionContext
): TransitionOutcome {
  if (user.currentStage !== CurrentStage.FAKE_END) {
    return err(
      domainErr(
        DomainErrorCode.EPILOGUE_NOT_ALLOWED,
        `cannot view epilogue in stage ${user.currentStage}`
      )
    );
  }
  return ok({
    progress: {
      ...user,
      currentStage: CurrentStage.COMPLETE,
      epilogueViewedAt: user.epilogueViewedAt ?? ctx.now,
      completedAt: user.completedAt ?? ctx.now,
      updatedAt: ctx.now,
      stateVersion: user.stateVersion + 1,
    },
    events: [
      { type: "EPILOGUE_VIEWED" },
      {
        type: "STAGE_TRANSITION",
        fromStage: CurrentStage.FAKE_END,
        toStage: CurrentStage.COMPLETE,
      },
    ],
  });
}
