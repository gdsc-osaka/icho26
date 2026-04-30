import type { AnswerStage } from "./types";

const ANSWERS: Record<AnswerStage, string> = {
  Q1_1: "4,6",
  Q1_2: "2,3",
  Q2: "coffeecup",
  Q3_KEYWORD: "はきだめにつる",
  Q3_CODE: "2236",
  Q4: "29",
} as const;

export function isCorrect(
  stage: AnswerStage,
  normalizedInput: string,
): boolean {
  return ANSWERS[stage] === normalizedInput;
}
