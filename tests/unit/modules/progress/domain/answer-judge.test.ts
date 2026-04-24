import { describe, it, expect } from "vitest";
import {
  isQ1AnswerCorrect,
  isQ2AnswerCorrect,
  isQ3CodeCorrect,
  isQ3KeywordCorrect,
  isQ4AnswerCorrect,
} from "~/modules/progress/domain/answer-judge";
import { SubQuestion } from "~/modules/progress/domain/stage";

describe("answer-judge (fixture answers)", () => {
  it("Q1-1 accepts '42' only", () => {
    expect(isQ1AnswerCorrect(SubQuestion.Q1_1, "42")).toBe(true);
    expect(isQ1AnswerCorrect(SubQuestion.Q1_1, "43")).toBe(false);
  });

  it("Q1-2 accepts '7' only", () => {
    expect(isQ1AnswerCorrect(SubQuestion.Q1_2, "7")).toBe(true);
    expect(isQ1AnswerCorrect(SubQuestion.Q1_2, "42")).toBe(false);
  });

  it("Q2 accepts 'coffeecup' only", () => {
    expect(isQ2AnswerCorrect("coffeecup")).toBe(true);
    expect(isQ2AnswerCorrect("coffee cup")).toBe(false);
  });

  it("Q3 keyword accepts 'hakidamenitsuru' only", () => {
    expect(isQ3KeywordCorrect("hakidamenitsuru")).toBe(true);
    expect(isQ3KeywordCorrect("hakidame")).toBe(false);
  });

  it("Q3 code accepts '2.24' only", () => {
    expect(isQ3CodeCorrect("2.24")).toBe(true);
    expect(isQ3CodeCorrect("2.2")).toBe(false);
  });

  it("Q4 accepts '29' only", () => {
    expect(isQ4AnswerCorrect("29")).toBe(true);
    expect(isQ4AnswerCorrect("30")).toBe(false);
  });
});
