-- 0007 — Reconcile quiz_reviews.helpful_count with review_helpful_votes.
--
-- This is a DATA-ONLY migration. There is no schema delta here: column
-- definitions, indexes, constraints, and types are all unchanged from 0006.
-- The drift the migration repairs is an application bug — denormalized
-- counters `helpful_count` and `review_helpful_votes` could disagree
-- because the application incremented one without the other.
--
-- Idempotent: re-running it leaves a consistent database unchanged.
--
-- Two updates, deliberately split (see docs/plans/helpful-vote-counter-reconciliation.md §7 phase 1):
--
--   1. For every review with at least one vote, set helpful_count to the
--      actual count. WHERE filters out rows whose counter already
--      matches.
--   2. For every review with zero votes and a non-zero helpful_count,
--      reset the counter to 0. Idempotent because helpful_count = 0
--      is already correct, so the UPDATE matches no rows in that case.

BEGIN;

-- 1) Bring `helpful_count` in line with the actual vote table where
--    a vote table has at least one row.
UPDATE quiz_reviews AS r
SET helpful_count = v.cnt,
    updated_at   = NOW()
FROM (
  SELECT review_id, COUNT(*)::smallint AS cnt
  FROM review_helpful_votes
  GROUP BY review_id
) AS v
WHERE r.review_id = v.review_id
  AND r.helpful_count IS DISTINCT FROM v.cnt;

-- 2) Zero out `helpful_count` for reviews with no votes that still
--    carry a non-zero denormalized counter (the second-class bug).
UPDATE quiz_reviews AS r
SET helpful_count = 0,
    updated_at   = NOW()
WHERE r.helpful_count <> 0
  AND NOT EXISTS (
    SELECT 1 FROM review_helpful_votes v WHERE v.review_id = r.review_id
  );

COMMIT;
