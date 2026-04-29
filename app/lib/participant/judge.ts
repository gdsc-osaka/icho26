import type { AnswerStage } from "./types";

const ANSWERS: Record<AnswerStage, string> = {
  Q1_1: "42",
  Q1_2: "7",
  Q2: "coffeecup",
  Q3_KEYWORD: "hakidamenitsuru",
  Q3_CODE: "2.24",
  Q4: "29",
} as const;

export function isCorrect(
  stage: AnswerStage,
  normalizedInput: string,
): boolean {
  return ANSWERS[stage] === normalizedInput;
}
