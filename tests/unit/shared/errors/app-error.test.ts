import { describe, it, expect } from "vitest";
import { AppError, ErrorCode, isAppError } from "~/shared/errors";

describe("AppError", () => {
  it("maps error codes to the correct HTTP status", async () => {
    const cases: Array<[ErrorCode, number]> = [
      [ErrorCode.BAD_REQUEST, 400],
      [ErrorCode.UNAUTHORIZED, 401],
      [ErrorCode.FORBIDDEN, 403],
      [ErrorCode.NOT_FOUND, 404],
      [ErrorCode.CONFLICT_STATE, 409],
      [ErrorCode.INTERNAL_ERROR, 500],
    ];
    for (const [code, status] of cases) {
      const e = new AppError({ code, message: "m", requestId: "r" });
      expect(e.httpStatus).toBe(status);
    }
  });

  it("serializes to a JSON response with code, message, requestId", async () => {
    const e = new AppError({
      code: ErrorCode.CONFLICT_STATE,
      message: "stage conflict",
      requestId: "req-1",
    });
    const res = e.toResponse();
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body).toEqual({
      error: {
        code: "CONFLICT_STATE",
        message: "stage conflict",
        requestId: "req-1",
      },
    });
  });

  it("isAppError distinguishes AppError from other errors", () => {
    const app = new AppError({
      code: ErrorCode.BAD_REQUEST,
      message: "x",
      requestId: "r",
    });
    expect(isAppError(app)).toBe(true);
    expect(isAppError(new Error("plain"))).toBe(false);
    expect(isAppError("not-error")).toBe(false);
    expect(isAppError(null)).toBe(false);
  });
});
