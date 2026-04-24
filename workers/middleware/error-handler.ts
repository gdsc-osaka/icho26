import { REQUEST_ID_HEADER } from "~/shared/context/request-id";
import type { Logger } from "~/shared/context/logger";
import { toAppError } from "~/shared/errors/to-app-error";

export async function handleErrors(
  fn: () => Promise<Response>,
  params: { requestId: string; logger: Logger }
): Promise<Response> {
  try {
    const response = await fn();
    if (!response.headers.has(REQUEST_ID_HEADER)) {
      response.headers.set(REQUEST_ID_HEADER, params.requestId);
    }
    return response;
  } catch (error) {
    const appError = toAppError(error, params.requestId);
    params.logger.error("request_failed", {
      code: appError.code,
      httpStatus: appError.httpStatus,
      message: appError.message,
    });
    const response = appError.toResponse();
    response.headers.set(REQUEST_ID_HEADER, params.requestId);
    return response;
  }
}
