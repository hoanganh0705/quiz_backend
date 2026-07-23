-- 0018 — Phase 1 / Foundational Correctness: optimistic locking for
-- `quiz_instances`.
--
-- The previous `updateInstanceStatus` repository call performed an
-- unconditional UPDATE keyed only on `instance_id`. Concurrent start
-- requests from the host (e.g. a double-click on the "Start" button, a
-- retry triggered by a flaky network, or two tabs racing the same action)
-- could therefore each pass the in-memory "status is open" check,
-- increment the state twice, and leave the instance with two
-- `InstanceStartedEvent` emissions — or worse, a player-attempt context
-- that's been half-built against the second transition.
--
-- The standard remedy is an integer version column, plus a `WHERE version = ?
-- RETURNING version + 1` clause on every state transition. Lost updates
-- return zero rows, which the application layer translates to a
-- domain-level "concurrent update" error.
--
-- Why integer, not UUID or ulid
-- -----------------------------
--
--   * 4 bytes, monotonic per row, cheap to compare.
--   * Plays nicely with the PG advisory-lock style of "compare-and-swap"
--     that Drizzle composes naturally:
--       UPDATE quiz_instances
--          SET status = $1, version = version + 1
--        WHERE instance_id = $2 AND version = $3
--     `RETURNING version` lets the caller observe the new value and
--     chain further transitions off of it.
--
-- Why `DEFAULT 1 NOT NULL`
-- ------------------------
--
--   * `1` matches the natural first version of a freshly inserted row,
--     so the application can omit it on INSERT and have the DB fill it
--     in.
--   * NOT NULL closes the backfill door: every row in production has a
--     version, and a future regression that forgets to thread the value
--     through cannot silently insert `version = NULL`.
--
-- Backfill
-- --------
--
-- Pre-existing rows get `version = 1`. There's no semantic value to
-- preserving on the column — the optimistic-lock protocol only cares
-- that the row's prior write saw some version `v` and observed a
-- different version `v+1` on its next read.
--
-- Idempotency
-- -----------
--
-- `ADD COLUMN IF NOT EXISTS` keeps the migration safe to re-run on a
-- database that already has the column. The backfill UPDATE is also a
-- no-op when every row already has `version = 1`.
--
-- Forward-looking notes
-- ---------------------
--
--   * The `version` column is not exposed via any response DTO. It is
--     a private concurrency primitive consumed only by the repository.
--   * `updateInstanceStatus` is the single transition surface in the
--     current codebase; any future transition path (countdown start,
--     host transfer) MUST route through `WHERE version = ?` to keep
--     the invariant atomic.

BEGIN;

ALTER TABLE quiz_instances
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

-- Defensive non-negative check: the column is monotonically incremented,
-- so a negative value would indicate a corruption or a manual UPDATE
-- that bypassed the repository. We don't use `version >= 1` to leave room
-- for any future bootstrap that needs to seed `0` once, but we do reject
-- `version < 0` outright.
ALTER TABLE quiz_instances
  DROP CONSTRAINT IF EXISTS quiz_instances_version_nonneg;
ALTER TABLE quiz_instances
  ADD CONSTRAINT quiz_instances_version_nonneg
  CHECK (version >= 0);

COMMIT;
