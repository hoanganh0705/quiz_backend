-- 0015 — Phase 5 / Issue #17 — Add a `deleted_at` column on
-- `quiz_reviews` so user-initiated and moderator-initiated deletes
-- become soft deletes. The previous shape issued a hard `DELETE`
-- on `quiz_reviews` and let the FK `ON DELETE CASCADE` on
-- `review_helpful_votes` erase every vote against that review with
-- no UI signal for the voter. Soft-deleting preserves both the
-- review row and its helpful-vote rows; the repository filters
-- every public read by `deleted_at IS NULL` so the row is
-- invisible to clients while remaining queryable for moderation
-- audit and reconciliation jobs.
--
-- Why this is needed
-- -------------------
--
-- Hard-delete loses information:
--
--   1. Users who voted "helpful" lose their vote silently — the
--      vote row disappears with the parent, with no notification
--      or API response.
--   2. The author cannot recover from an accidental self-delete.
--   3. Moderators who soft-delete a report-flagged review have no
--      audit trail once the row is gone.
--   4. Reconciliation jobs (`quiz-analytics.refreshReviewMetrics`)
--      and the helpful-cursor pagination can't tell whether a row
--      was hard-deleted versus never existed.
--
-- Behavior under the new column
-- -----------------------------
--
--   * `deleted_at IS NULL` ⇒ row is live and visible everywhere.
--   * `deleted_at IS NOT NULL` ⇒ row is soft-deleted, invisible to
--     every public read path, but the helpful-vote rows are
--     preserved so voters can withdraw their vote via
--     `DELETE /reviews/:reviewId/helpful`.
--
-- Pre-existing data migration
-- ---------------------------
--
-- Today every `quiz_reviews` row is live (no `deleted_at`), so the
-- column is added with `NULL` default and a partial index on
-- active rows keeps the existing read paths efficient.
--
-- Idempotent: re-running on a table that already has the column
-- raises `42710 duplicate_column`. Operators can safely `IF NOT
-- EXISTS` the column to retry.

BEGIN;

ALTER TABLE quiz_reviews
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Partial index — repository filters every public read by
-- `deleted_at IS NULL`, so a partial index on live rows gives the
-- planner the same scan shape it had before while keeping the
-- index small as soft-deleted rows accumulate.
CREATE INDEX IF NOT EXISTS idx_quiz_reviews_active_created_at_desc
  ON quiz_reviews (quiz_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- A matching partial index for the helpful-sort pagination so
-- `helpful_count DESC, review_id DESC` over live rows stays
-- efficient.
CREATE INDEX IF NOT EXISTS idx_quiz_reviews_active_helpful_count_desc
  ON quiz_reviews (helpful_count DESC, review_id DESC)
  WHERE deleted_at IS NULL;

COMMIT;