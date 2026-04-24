import { describe, it, expect } from "vitest";
import { AppError, ErrorCode, toAppError } from "~/shared/errors";

describe("toAppError", () => {
  it("returns AppError unchanged", () => {
    const original = new AppError({
      code: ErrorCode.NOT_FOUND,
      message: "no",
      requestId: "r",
    });
    expect(toAppError(original, "r2")).toBe(original);
  });

  it("wraps a plain Error as INTERNAL_ERROR", () => {
    const e = toAppError(new Error("boom"), "req-1");
    expect(e.code).toBe(ErrorCode.INTERNAL_ERROR);
    expect(e.message).toBe("boom");
    expect(e.httpStatus).toBe(500);
    expect(e.requestId).toBe("req-1");
  });

  it("wraps non-Error values as INTERNAL_ERROR with generic message", () => {
    const e = toAppError("string", "req-2");
    expect(e.code).toBe(ErrorCode.INTERNAL_ERROR);
    expect(e.message).toBe("Unknown error");
    expect(e.requestId).toBe("req-2");
  });
});
