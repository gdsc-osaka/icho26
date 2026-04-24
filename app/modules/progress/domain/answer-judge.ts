import { SubQuestion } from "./stage";

const FIXTURE_ANSWERS = {
  Q1_1: "42",
  Q1_2: "7",
  Q2: "coffeecup",
  Q3_KEYWORD: "hakidamenitsuru",
  Q3_CODE: "2.24",
  Q4: "29",
} as const;

export function isQ1AnswerCorrect(
  subQuestion: SubQuestion,
  normalizedAnswer: string
): boolean {
  if (subQuestion === SubQuestion.Q1_1) {
    return normalizedAnswer === FIXTURE_ANSWERS.Q1_1;
  }
  return normalizedAnswer === FIXTURE_ANSWERS.Q1_2;
}

export function isQ2AnswerCorrect(normalizedAnswer: string): boolean {
  return normalizedAnswer === FIXTURE_ANSWERS.Q2;
}

export function isQ3KeywordCorrect(normalizedAnswer: string): boolean {
  return normalizedAnswer === FIXTURE_ANSWERS.Q3_KEYWORD;
}

export function isQ3CodeCorrect(normalizedAnswer: string): boolean {
  return normalizedAnswer === FIXTURE_ANSWERS.Q3_CODE;
}

export function isQ4AnswerCorrect(normalizedAnswer: string): boolean {
  return normalizedAnswer === FIXTURE_ANSWERS.Q4;
}
