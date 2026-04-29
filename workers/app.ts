import { createRequestHandler } from "react-router";
import type { AppEnv } from "~/lib/shared/env";

declare module "react-router" {
  interface AppLoadContext {
    cloudflare: {
      env: AppEnv;
      ctx: ExecutionContext;
    };
  }
}

// `import.meta.env` is a vite-only construct. wrangler / Workers Builds
// bundle this file with esbuild, which doesn't define it — guard the access
// and fall back to "production" so the bundled worker doesn't crash at boot.
const mode =
  (import.meta as { env?: { MODE?: string } }).env?.MODE ?? "production";

const requestHandler = createRequestHandler(
  // virtual module is provided by @react-router/dev at build time
  () => import("virtual:react-router/server-build"),
  mode,
);

export default {
  async fetch(request, env, ctx) {
    return requestHandler(request, { cloudflare: { env, ctx } });
  },
} satisfies ExportedHandler<AppEnv>;
