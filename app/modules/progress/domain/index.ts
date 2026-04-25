export * from "./stage";
export * from "./progress";
export * from "./errors";
export * from "./events";
export { normalizeAnswer } from "./answer-normalizer";
export {
  isQ1AnswerCorrect,
  isQ2AnswerCorrect,
  isQ3KeywordCorrect,
  isQ3CodeCorrect,
  isQ4AnswerCorrect,
} from "./answer-judge";
export {
  startOrResumeSession,
  submitQ1Answer,
  confirmQ1Checkpoint,
  submitQ2Answer,
  confirmQ2Checkpoint,
  submitQ3Keyword,
  submitQ3Code,
  submitQ4Answer,
  markEpilogueViewed,
} from "./state-machine";
export type {
  TransitionContext,
  TransitionResult,
  TransitionOutcome,
} from "./state-machine";
