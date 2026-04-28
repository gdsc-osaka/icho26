import type { AppEnv } from "~/lib/shared/env";

declare module "react-router" {
  interface AppLoadContext {
    cloudflare: {
      env: AppEnv;
      ctx: ExecutionContext;
    };
  }
}

export {};
