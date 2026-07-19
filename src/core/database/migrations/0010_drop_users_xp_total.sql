-- 0010 — Drop `users.xp_total` and the `users_xp_nonneg` CHECK constraint.
--
-- The audit (`docs/plans/denormalized-counters-audit.md` — Fix #3) flagged
-- `users.xp_total` as a HIGH-risk denormalized counter that is never
-- written in production (the XP write path goes through `user_ranking`,
-- which is the authoritative per-period source of truth). The column
-- always reads 0 from the application, which is a data-correctness bug
-- visible to every user through the profile endpoint.
--
-- Decision (re-affirmed by product): drop the column entirely. Source
-- the `xpTotal` field on the profile response via a `LEFT JOIN
-- user_ranking` in the user/auth repository SELECT — exactly the same
-- `xpTotal` shape, just never denormalized.
--
-- This is a structural DROP migration (NOT a data-only migration).
-- Snapshot `0010_snapshot.json` reflects the post-drop schema.
--
-- The `badge_rule_type` enum value `'xp_total'` is intentionally
-- retained: removing a value from a Postgres enum requires a
-- `CREATE TYPE … ALTER TYPE … DROP TYPE` dance unrelated to this fix.
-- `'xp_total'` is referenced by `badge_rule_type.rule_type` as a metric
-- label and continues to work even after this column drop.

BEGIN;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_xp_nonneg;
ALTER TABLE users DROP COLUMN IF EXISTS xp_total;

COMMIT;
