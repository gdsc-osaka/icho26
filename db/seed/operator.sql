-- Seed for the `operator_credentials` table.
--
-- Usage (local):
--   wrangler d1 execute <database-name> --local --file=db/seed/operator.sql
--
-- The hash below corresponds to the password `operator-dev-only`. It is
-- intended for **local development only** and MUST NOT be applied to the
-- remote/production D1.
--
-- For production:
--   1. Choose a strong password (do not commit it to the repo)
--   2. Run the generator and pipe the output to remote D1:
--        node db/seed/generate-operator-credentials.mjs '<chosen-password>' \
--          | wrangler d1 execute <database-name> --remote --command -
--   3. Communicate the password to operators out of band
--
-- The `INSERT OR REPLACE` semantics mean reapplying this file resets the
-- single-row credentials table to the dev value; do not run it against a
-- database whose operator password should remain in production state.

INSERT OR REPLACE INTO operator_credentials (
  operator_id, password_hash_b64, password_salt_b64, password_iterations, created_at, updated_at
) VALUES (
  'operator', 'xDTMPpSxSkxkDcjM5mVvCb4ddR05omfw6KFzLifhAdY=', '0PzmygIRz9jLaC+H0FakWA==', 100000, '2026-04-29T09:55:04.846Z', '2026-04-29T09:55:04.846Z'
);
