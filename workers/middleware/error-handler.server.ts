import { AppError } from "~/shared/errors";

export function handleError(error: unknown, requestId: string): Response {
  if (error instanceof AppError) {
    return error.toResponse();
  }

  console.error(`[${requestId}] Unhandled error:`, error);

  return Response.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred.",
        requestId,
      },
    },
    { status: 500 }
  );
}
