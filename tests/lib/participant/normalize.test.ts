import { describe, it, expect } from "vitest";
import { normalize } from "~/lib/participant/normalize";

describe("normalize", () => {
  it("trims surrounding whitespace", () => {
    expect(normalize("  42  ")).toBe("42");
    expect(normalize("\tcoffee\n")).toBe("coffee");
  });

  it("converts full-width digits to half-width", () => {
    expect(normalize("４２")).toBe("42"); // ４２
    expect(normalize("０")).toBe("0"); // ０
  });

  it("converts full-width ASCII letters to half-width and lowercases", () => {
    expect(normalize("Ｃｏｆｆｅｅ")).toBe("coffee"); // Ｃｏｆｆｅｅ
    expect(normalize("ＡＢＣ")).toBe("abc"); // ＡＢＣ
  });

  it("lowercases ASCII letters", () => {
    expect(normalize("Coffee")).toBe("coffee");
    expect(normalize("HAKIDAMENITSURU")).toBe("hakidamenitsuru");
  });

  it("strips leading zeros from integer-like strings", () => {
    expect(normalize("029")).toBe("29");
    expect(normalize("007")).toBe("7");
  });

  it("preserves a single zero", () => {
    expect(normalize("0")).toBe("0");
    expect(normalize("00")).toBe("0");
  });

  it("does not strip leading zeros from non-integer strings", () => {
    expect(normalize("2.24")).toBe("2.24");
    expect(normalize("0.5")).toBe("0.5");
    expect(normalize("0a")).toBe("0a");
  });

  it("combines all rules", () => {
    expect(normalize("  Coffee  ")).toBe("coffee");
    expect(normalize(" 042 ")).toBe("42");
    expect(normalize("０４２")).toBe("42"); // 全角ゼロ埋め "042"
  });
});
