-- 0011 — Add `users.last_streak_day` for the streak subsystem
-- (`docs/plans/user-streak-system.md` — Fix #4).
--
-- The audit (`docs/plans/denormalized-counters-audit.md` §4.2) flagged
-- `current_streak` / `longest_streak` as caches with no maintenance path.
-- Phase A of Fix #4 introduces the third cache column, `last_streak_day`,
-- which the hot-path UPDATE in §3.1 reads to derive the next cache state
-- (`prev → next` transition per the §1.3 gap rule).
--
-- `last_streak_day` is the most recent UTC calendar day on which the user
-- has at least one `quiz_attempts` row with `status = 'completed'`. The
-- column is nullable (a user who has never completed an attempt has
-- `NULL`).
--
-- Invariants enforced by CHECK constraints:
--   * `last_streak_day IS NULL OR last_streak_day <= current_date`
--     (`finished_at` clock skew that lands in the future would violate
--     this; the attempt repository rejects such values upstream.)
--
-- The existing `users_streak_nonneg` and `users_streak_order` CHECK
-- constraints are not touched; this migration is strictly additive.
--
-- This is a structural ADD migration (NOT a data-only migration).
-- Snapshot `0011_snapshot.json` reflects the post-add schema.
--
-- Backfill is intentionally NOT shipped here. Backfill of
-- `last_streak_day` (and any drift correction on `current_streak` /
-- `longest_streak`) lives in Phase B's
-- `scripts/backfill/user-streak.ts` per the design §6 / §8.

BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS last_streak_day DATE;

ALTER TABLE users
  ADD CONSTRAINT users_streak_day_not_future
  CHECK (last_streak_day IS NULL OR last_streak_day <= current_date);

COMMIT;