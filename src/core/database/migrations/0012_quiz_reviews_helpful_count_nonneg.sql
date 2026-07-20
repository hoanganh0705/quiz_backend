-- 0012 — Phase 2 / Issue #4 — Add a CHECK constraint that
-- `quiz_reviews.helpful_count` is non-negative.
--
-- Why this is needed
-- ------------------
--
-- The application-level `addHelpfulVote` / `removeHelpfulVote` paths
-- already gate the counter: `addHelpfulVote` only increments when the
-- insert survived `onConflictDoNothing`, and `removeHelpfulVote` only
-- decrements when a row was actually deleted. But the gate is
-- application-only. A regression that introduces an unconditional
-- decrement (e.g. a future bulk-clear path, or a manual DBA fix) would
-- otherwise produce a row with `helpful_count = -1` that survives every
-- reconciliation job and leaks into the public DTO.
--
-- Behavior under the new constraint
-- ----------------------------------
--
-- Postgres rejects the offending UPDATE at COMMIT time with a
-- `23514 check_violation`. The repository's existing try/catch is not
-- tuned for that error today, but a `helpful_count = -1` UPDATE is
-- already a programming error, so a 500 with a logged error is the
-- correct production signal.
--
-- This is a structural ADD migration (NOT a data-only migration).
-- Snapshot `0012_snapshot.json` reflects the post-add schema.
--
-- Idempotent: re-running on an already-constrained table is a no-op
-- because of `IF NOT EXISTS`.

BEGIN;

ALTER TABLE quiz_reviews
  ADD CONSTRAINT quiz_reviews_helpful_count_nonneg
  CHECK (helpful_count >= 0);

COMMIT;
