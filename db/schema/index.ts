export * from "./users";
export * from "./attempt-logs";
export * from "./progress-logs";
export * from "./checkpoint-codes";
export * from "./operator-credentials";
export * from "./operator-sessions";
export * from "./operator-actions";

export const STAGES = [
  "START",
  "Q1",
  "Q2",
  "Q3_KEYWORD",
  "Q3_CODE",
  "Q4",
  "FAKE_END",
  "COMPLETE",
] as const;
export const Q1_ORDERS = ["Q1_1_FIRST", "Q1_2_FIRST"] as const;
export const SUB_QUESTIONS = ["Q1_1", "Q1_2"] as const;
export const ANSWER_STAGES = [
  "Q1_1",
  "Q1_2",
  "Q2",
  "Q3_KEYWORD",
  "Q3_CODE",
  "Q4",
] as const;

export type Stage = (typeof STAGES)[number];
export type Q1Order = (typeof Q1_ORDERS)[number];
export type SubQuestion = (typeof SUB_QUESTIONS)[number];
export type AnswerStage = (typeof ANSWER_STAGES)[number];
