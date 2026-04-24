import { AppError, isAppError } from "./app-error";
import { ErrorCode } from "./error-codes";

export function toAppError(error: unknown, requestId: string): AppError {
  if (isAppError(error)) {
    return error;
  }

  const message = error instanceof Error ? error.message : "Unknown error";
  return new AppError({
    code: ErrorCode.INTERNAL_ERROR,
    message,
    requestId,
    cause: error,
  });
}
