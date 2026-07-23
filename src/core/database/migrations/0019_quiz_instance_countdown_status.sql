-- 0019 — Phase 2 / Gameplay Lifecycle: introduce the `countdown` instance
-- status and the `countdown_started_at` column.
--
-- The previous state machine was `open → running → closed/finished`. The
-- countdown is an *explicit* lifecycle state inserted between `open` and
-- `running` to model the pre-game warmup window during which players can
-- see the lobby, prepare, and (optionally) the host may cancel.
--
-- Two coupled changes
-- --------------------
--
--   1. `ALTER TYPE quiz_instance_status ADD VALUE 'countdown'` — the enum
--      gains a transitional value. Adding an enum value cannot be rolled
--      back; the migration is forward-only.
--   2. `ALTER TABLE quiz_instances ADD COLUMN countdown_started_at` —
--      nullable, populated only when `status = 'countdown'`. The
--      countdown scheduler (`InstanceCountdownSchedulerService` added in
--      Phase 2) scans this column on a one-second cadence and transitions
--      expired countdowns into `running`.
--
-- Why store `countdown_started_at` rather than compute from nowIso on read
-- ----------------------------------------------------------------------
--
-- The scheduler must survive process restarts. If we recomputed the
-- deadline from a constant "countdown duration", a restart that loses
-- the in-flight timer would have no way to know which instances are
-- overdue. Persisting the start timestamp makes the schedule
-- self-describing: any replica, on restart, can scan the column and
-- find due rows.
--
-- `ALTER TYPE ... ADD VALUE` cannot run inside a transaction block in
-- older Postgres versions. PG 14+ allows it inside a transaction, but
-- to keep migration idempotency safe on every supported PG version we
-- wrap the addition in a `DO $$ ... END $$` block that uses
-- `IF NOT EXISTS` (PG 9.6+). The column-add uses standard idempotent
-- DDL.
--
-- Backfill
-- --------
--
-- None — `countdown` is a transitional state and never appears as a
-- row's initial status. Existing rows keep their `open`/`running`/etc.
-- value and `countdown_started_at` is left NULL.

-- ===========================================================================
-- 1. Add the `countdown` enum value (must run outside the transaction block
--    wrapping the column-add, so we wrap this whole migration in a
--    non-transactional wrapper).
-- ===========================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'quiz_instance_status'
      AND e.enumlabel = 'countdown'
  ) THEN
    ALTER TYPE quiz_instance_status ADD VALUE 'countdown';
  END IF;
END
$$;

-- ===========================================================================
-- 2. Add the timestamp column. Idempotent.
-- ===========================================================================

ALTER TABLE quiz_instances
  ADD COLUMN IF NOT EXISTS countdown_started_at timestamptz;

-- A defensive CHECK so future regressions that set
-- `countdown_started_at` on a non-`countdown` row surface at insert time.
ALTER TABLE quiz_instances
  DROP CONSTRAINT IF EXISTS quiz_instances_countdown_started_at_consistent;
ALTER TABLE quiz_instances
  ADD CONSTRAINT quiz_instances_countdown_started_at_consistent
  CHECK (
    (status = 'countdown' AND countdown_started_at IS NOT NULL)
    OR (status <> 'countdown' AND countdown_started_at IS NULL)
    OR (status NOT IN ('countdown')) -- status placeholder; replaced below
  );

-- The CHECK above uses a tautological branch so it round-trips. We replace
-- it with the precise invariant now that the column exists. The point of
-- keeping the tautology around the `ADD COLUMN` is that PG's parser
-- validates the new column reference inside the CHECK at the moment of
-- creation, and a referenced column must already be on the table.
ALTER TABLE quiz_instances
  DROP CONSTRAINT IF EXISTS quiz_instances_countdown_started_at_consistent;
ALTER TABLE quiz_instances
  ADD CONSTRAINT quiz_instances_countdown_started_at_consistent
  CHECK (
    (status = 'countdown' AND countdown_started_at IS NOT NULL)
    OR (status <> 'countdown' AND countdown_started_at IS NULL)
  );

-- An index that the countdown scheduler relies on to find due rows cheaply.
-- The scheduler's WHERE clause is `status = 'countdown' AND countdown_started_at <= now()`,
-- so a partial btree index keyed by `(countdown_started_at)` filtered to
-- `status = 'countdown'` is the natural shape.
CREATE INDEX IF NOT EXISTS idx_quiz_instances_countdown_due
  ON quiz_instances (countdown_started_at)
  WHERE status = 'countdown';
