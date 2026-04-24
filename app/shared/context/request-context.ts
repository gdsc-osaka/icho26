import type { AppEnv } from "../../../workers/bindings/env";
import { createLogger, type Logger } from "./logger";
import { getOrCreateRequestId } from "./request-id";

export interface RequestContext {
  readonly requestId: string;
  readonly now: Date;
  readonly env: AppEnv;
  readonly logger: Logger;
}

export function createRequestContext(request: Request, env: AppEnv): RequestContext {
  const requestId = getOrCreateRequestId(request);
  return {
    requestId,
    now: new Date(),
    env,
    logger: createLogger(requestId),
  };
}
