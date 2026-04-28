-- Seed for the `checkpoint_codes` table (local development).
--
-- Usage (local):
--   wrangler d1 execute <database-name> --local --file=db/seed/checkpoint-codes.sql
--
-- The values below are dev placeholders intended to unblock checkpoint flow
-- testing in Step 2 of the implementation roadmap. Production deployment must
-- replace these with hard-to-guess random tokens before seeding remote D1.

INSERT OR IGNORE INTO checkpoint_codes (code, stage, label, active, created_at) VALUES
  ('cp_q1_1_dev', 'Q1_1', 'Dev placeholder: Q1-1 checkpoint', 1, '2026-04-29T00:00:00.000Z'),
  ('cp_q1_2_dev', 'Q1_2', 'Dev placeholder: Q1-2 checkpoint', 1, '2026-04-29T00:00:00.000Z'),
  ('cp_q2_dev',   'Q2',   'Dev placeholder: Q2 checkpoint',   1, '2026-04-29T00:00:00.000Z');
