import { describe, it, expect } from "vitest";
import { isCorrect } from "~/lib/participant/judge";
import { normalize } from "~/lib/participant/normalize";

describe("isCorrect", () => {
  it.each([
    ["Q1_1", "42", true],
    ["Q1_1", "43", false],
    ["Q1_2", "7", true],
    ["Q2", "coffeecup", true],
    ["Q3_KEYWORD", "hakidamenitsuru", true],
    ["Q3_CODE", "2.24", true],
    ["Q4", "29", true],
  ] as const)(
    "%s with %s returns %s",
    (stage, normalized, expected) => {
      expect(isCorrect(stage, normalized)).toBe(expected);
    },
  );

  it("integrates with normalize for full-width / mixed-case input", () => {
    expect(isCorrect("Q1_1", normalize("０４２"))).toBe(true);
    expect(isCorrect("Q2", normalize("Coffee Cup".replace(" ", "")))).toBe(true);
    expect(isCorrect("Q4", normalize("  ２９  "))).toBe(true);
  });
});
