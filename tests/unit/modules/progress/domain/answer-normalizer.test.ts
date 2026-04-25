import { describe, it, expect } from "vitest";
import { normalizeAnswer } from "~/modules/progress/domain/answer-normalizer";

describe("normalizeAnswer", () => {
  it("trims leading/trailing whitespace", () => {
    expect(normalizeAnswer("  abc  ")).toBe("abc");
  });

  it("converts full-width alphanumerics to half-width", () => {
    expect(normalizeAnswer("ＡＢＣ１２３")).toBe("abc123");
  });

  it("lowercases English letters", () => {
    expect(normalizeAnswer("COFFEEcup")).toBe("coffeecup");
  });

  it("strips leading zeros for integer inputs (029 -> 29)", () => {
    expect(normalizeAnswer("029")).toBe("29");
    expect(normalizeAnswer("007")).toBe("7");
  });

  it("preserves a single zero for input '0' and repeated zeros", () => {
    expect(normalizeAnswer("0")).toBe("0");
    expect(normalizeAnswer("000")).toBe("0");
  });

  it("does not strip leading zeros from non-integer values like 2.24", () => {
    expect(normalizeAnswer("2.24")).toBe("2.24");
    expect(normalizeAnswer("0.5")).toBe("0.5");
  });

  it("combines trim + full-width + lowercase + zero-stripping", () => {
    expect(normalizeAnswer("  ０２９  ")).toBe("29");
    expect(normalizeAnswer("  Ｃｏｆｆｅｅ Cup  ")).toBe("coffee cup");
  });
});
