import { ErrorCode, ErrorCodeToHttpStatus } from "./error-codes";

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly httpStatus: number;
  readonly requestId: string;
  override readonly cause?: unknown;

  constructor(params: {
    code: ErrorCode;
    message: string;
    requestId: string;
    cause?: unknown;
  }) {
    super(params.message);
    this.name = "AppError";
    this.code = params.code;
    this.httpStatus = ErrorCodeToHttpStatus[params.code];
    this.requestId = params.requestId;
    this.cause = params.cause;
  }

  toResponseBody(): AppErrorResponseBody {
    return {
      error: {
        code: this.code,
        message: this.message,
        requestId: this.requestId,
      },
    };
  }

  toResponse(): Response {
    return new Response(JSON.stringify(this.toResponseBody()), {
      status: this.httpStatus,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export interface AppErrorResponseBody {
  error: {
    code: ErrorCode;
    message: string;
    requestId: string;
  };
}

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}
