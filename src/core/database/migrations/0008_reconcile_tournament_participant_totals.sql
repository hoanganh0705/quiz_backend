-- 0008 — Reconcile tournament_participants.total_score / total_time_ms with
-- tournament_round_participants.
--
-- This is a DATA-ONLY migration. There is no schema delta here: column
-- definitions, indexes, constraints, and types are all unchanged from 0007.
--
-- The drift the migration repairs is an application bug: the denormalized
-- `tournament_participants.total_score` and `total_time_ms` columns could
-- disagree with `SUM(tournament_round_participants.round_score)` /
-- `SUM(tournament_round_participants.round_time_ms)` because the application
-- never updated them in the first place (see
-- docs/plans/denormalized-counters-audit.md — Fix #1).
--
-- Idempotent: re-running it leaves a consistent database unchanged.
--
-- Two updates, deliberately split (mirrors the pattern from
-- 0007_reconcile_helpful_count.sql):
--
--   1. For every tournament participant with at least one round participant,
--      set total_score / total_time_ms to the actual SUMs. WHERE filters out
--      rows whose cached totals already match.
--   2. For every tournament participant with zero round participants that
--      still carries a non-zero denormalized counter, reset the totals to 0.

BEGIN;

-- 1) Bring `total_score` / `total_time_ms` in line with the actual round
--    participant sums where round_participants has at least one row.
UPDATE tournament_participants AS tp
SET
  total_score   = agg.total_score,
  total_time_ms = agg.total_time_ms,
  updated_at    = NOW()
FROM (
  SELECT
    participant_id,
    COALESCE(SUM(round_score), 0)::int AS total_score,
    COALESCE(SUM(round_time_ms), 0)::int AS total_time_ms
  FROM tournament_round_participants
  GROUP BY participant_id
) AS agg
WHERE tp.participant_id = agg.participant_id
  AND (
    tp.total_score IS DISTINCT FROM agg.total_score
    OR tp.total_time_ms IS DISTINCT FROM agg.total_time_ms
  );

-- 2) Zero out totals for participants with no round participants that still
--    carry a non-zero denormalized counter (the second-class bug).
UPDATE tournament_participants AS tp
SET
  total_score   = 0,
  total_time_ms = 0,
  updated_at    = NOW()
WHERE (tp.total_score <> 0 OR tp.total_time_ms <> 0)
  AND NOT EXISTS (
    SELECT 1
    FROM tournament_round_participants trp
    WHERE trp.participant_id = tp.participant_id
  );

COMMIT;
