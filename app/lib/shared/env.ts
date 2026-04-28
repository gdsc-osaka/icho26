/**
 * Application-wide Cloudflare bindings as exposed to loaders/actions via
 * `context.cloudflare.env`. Keep in sync with `wrangler.toml`.
 */
export type AppEnv = {
  DB: D1Database;
  CACHE: KVNamespace;
};
