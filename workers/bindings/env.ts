export interface AppEnv {
  DB: D1Database;
  CACHE: KVNamespace;
  ENV: string;
  SESSION_SIGNING_KEY: string;
  OPERATOR_PASSWORD_HASH_B64?: string;
  OPERATOR_PASSWORD_SALT_B64?: string;
  OPERATOR_PASSWORD_ITERATIONS?: string;
}
