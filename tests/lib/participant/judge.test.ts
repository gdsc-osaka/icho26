import { describe, it, expect } from "vitest";
import { isCorrect } from "~/lib/participant/judge";
import { normalize } from "~/lib/participant/normalize";

describe("isCorrect", () => {
  it.each([
    ["Q1_1", "4,6", true],
    ["Q1_1", "6,4", false],
    ["Q1_1", "4", false],
    ["Q1_2", "2,2", true],
    ["Q1_2", "3,2", false],
    ["Q1_2", "2", false],
    ["Q2", "coffeecup", true],
    ["Q3_KEYWORD", "はきだめにつる", true],
    ["Q3_CODE", "2236", true],
    ["Q3_CODE", "1234", false],
    ["Q4", "29", true],
  ] as const)("%s with %s returns %s", (stage, normalized, expected) => {
    expect(isCorrect(stage, normalized)).toBe(expected);
  });

  it("integrates with normalize for full-width / mixed-case input", () => {
    // Q1_1 は x,y 形式: 各成分を別々に normalize して "," で連結
    expect(isCorrect("Q1_1", `${normalize("４")},${normalize("６")}`)).toBe(
      true,
    );
    expect(isCorrect("Q2", normalize("Coffee Cup".replace(" ", "")))).toBe(
      true,
    );
    expect(isCorrect("Q4", normalize("  ２９  "))).toBe(true);
  });
});
