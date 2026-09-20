-- =============================================================================
-- 0003_quiz_attempts_active_attempt_index
-- =============================================================================
-- Adds a partial composite index on (user_id, quiz_version_id) covering only
-- 'started' rows. This is a covering index for `getActiveAttemptByUserAndVersion`
-- in `AttemptRepository`, which uses:
--
--   SELECT ... FROM quiz_attempts
--   WHERE user_id = $1
--     AND quiz_version_id = $2
--     AND status = 'started'
--
-- Without this index, the lookup must either scan `idx_quiz_attempts_user_status`
-- (user_id, status) and filter on quiz_version_id in memory, or fall back to
-- `idx_quiz_attempts_quiz_version_id` and filter on user_id/status in memory.
-- Neither is ideal for high-throughput quiz start requests.
--
-- The partial predicate (`WHERE status = 'started'`) keeps the index narrow:
-- active attempts are a tiny fraction of total attempts. Estimated size is
-- orders of magnitude smaller than a full index on the same columns.
--
-- Note: idx_quiz_attempts_user_status and idx_quiz_attempts_version_status_created
-- are retained for status-only and version-status queries that don't filter by
-- the other leading column.
-- =============================================================================

CREATE INDEX "idx_quiz_attempts_user_version_started"
ON "quiz_attempts" USING btree ("user_id" uuid_ops, "quiz_version_id" uuid_ops)
WHERE "status" = 'started';--> statement-breakpoint
