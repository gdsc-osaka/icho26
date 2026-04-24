import type { AppEnv } from "../bindings/env";

export interface RequestContext {
  requestId: string;
  now: string;
  env: AppEnv;
}

export function createRequestContext(env: AppEnv): RequestContext {
  return {
    requestId: crypto.randomUUID(),
    now: new Date().toISOString(),
    env,
  };
}
