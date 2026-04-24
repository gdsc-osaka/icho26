import { describe, it, expect, vi } from "vitest";
import { handleErrors } from "~/workers/middleware/error-handler";
import { AppError, ErrorCode } from "~/shared/errors";
import type { Logger } from "~/shared/context/logger";

function createNoopLogger(): Logger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

describe("handleErrors middleware", () => {
  it("returns the original response and sets x-request-id if absent", async () => {
    const res = await handleErrors(
      async () => new Response("ok", { status: 200 }),
      { requestId: "req-1", logger: createNoopLogger() }
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("x-request-id")).toBe("req-1");
  });

  it("preserves existing x-request-id header from the response", async () => {
    const res = await handleErrors(
      async () =>
        new Response("ok", {
          status: 200,
          headers: { "x-request-id": "existing" },
        }),
      { requestId: "req-1", logger: createNoopLogger() }
    );
    expect(res.headers.get("x-request-id")).toBe("existing");
  });

  it("converts an AppError thrown by the handler to a JSON error response", async () => {
    const logger = createNoopLogger();
    const res = await handleErrors(
      async () => {
        throw new AppError({
          code: ErrorCode.NOT_FOUND,
          message: "gone",
          requestId: "req-1",
        });
      },
      { requestId: "req-1", logger }
    );
    expect(res.status).toBe(404);
    expect(res.headers.get("x-request-id")).toBe("req-1");
    const body = await res.json();
    expect(body).toEqual({
      error: { code: "NOT_FOUND", message: "gone", requestId: "req-1" },
    });
    expect(logger.error).toHaveBeenCalledWith("request_failed", expect.objectContaining({
      code: "NOT_FOUND",
      httpStatus: 404,
    }));
  });

  it("converts a plain Error to INTERNAL_ERROR", async () => {
    const logger = createNoopLogger();
    const res = await handleErrors(
      async () => {
        throw new Error("boom");
      },
      { requestId: "req-2", logger }
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({
      error: { code: "INTERNAL_ERROR", message: "boom", requestId: "req-2" },
    });
  });
});
