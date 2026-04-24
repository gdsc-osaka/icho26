export const CurrentStage = {
  START: "START",
  Q1: "Q1",
  Q2: "Q2",
  Q3_KEYWORD: "Q3_KEYWORD",
  Q3_CODE: "Q3_CODE",
  Q4: "Q4",
  FAKE_END: "FAKE_END",
  COMPLETE: "COMPLETE",
} as const;

export type CurrentStage = (typeof CurrentStage)[keyof typeof CurrentStage];

export const Q1Order = {
  Q1_1_FIRST: "Q1_1_FIRST",
  Q1_2_FIRST: "Q1_2_FIRST",
} as const;

export type Q1Order = (typeof Q1Order)[keyof typeof Q1Order];

export const SubQuestion = {
  Q1_1: "Q1_1",
  Q1_2: "Q1_2",
} as const;

export type SubQuestion = (typeof SubQuestion)[keyof typeof SubQuestion];

export const CheckpointMethod = {
  NFC: "NFC",
  QR: "QR",
} as const;

export type CheckpointMethod = (typeof CheckpointMethod)[keyof typeof CheckpointMethod];
