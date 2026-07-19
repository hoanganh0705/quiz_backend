-- 0009 — Reconcile discussion_threads.comments_count and
-- discussion_comments.replies_count with the actual rows.
--
-- This is a DATA-ONLY migration. There is no schema delta here: column
-- definitions, indexes, constraints, and types are all unchanged from 0008.
--
-- The drift the migration repairs is an application bug — the application
-- performs a non-transactional `UPDATE … count = count + 1` (or `-1`) after
-- `INSERT INTO discussion_comments` or `UPDATE … SET status = 'deleted'`,
-- without wrapping both writes in a single database transaction. A crash or
-- error path between the two statements leaves the cached counter wrong.
-- See `docs/plans/denormalized-counters-audit.md` — Fix #2.
--
-- Idempotent: re-running it leaves a consistent database unchanged.
--
-- Two updates, deliberately split (mirrors the pattern from
-- 0007_reconcile_helpful_count.sql / 0008_reconcile_tournament_participant_totals.sql):
--
--   1. `discussion_threads.comments_count`: for every thread, set the
--      counter to COUNT(*) of `discussion_comments` whose `thread_id`
--      matches AND `status = 'visible'`. (Soft-deleted comments are
--      excluded to match the runtime semantics used by
--      `incrementThreadCommentCount`.)
--      WHERE filters out threads whose counter already matches.
--
--   2. `discussion_comments.replies_count`: for every comment, set the
--      counter to COUNT(*) of `discussion_comments` whose
--      `parent_comment_id` matches AND `status = 'visible'`.
--      WHERE filters out comments whose counter already matches.

BEGIN;

-- 1) Bring `discussion_threads.comments_count` in line with the actual
--    visible comment counts.
UPDATE discussion_threads AS t
SET comments_count = counts.cnt,
    updated_at    = NOW()
FROM (
  SELECT thread_id, COUNT(*)::int AS cnt
  FROM discussion_comments
  WHERE status = 'visible'
  GROUP BY thread_id
) AS counts
WHERE t.thread_id = counts.thread_id
  AND t.comments_count IS DISTINCT FROM counts.cnt;

-- 2) Bring `discussion_comments.replies_count` in line with the actual
--    visible reply counts.
UPDATE discussion_comments AS c
SET replies_count = counts.cnt,
    updated_at   = NOW()
FROM (
  SELECT parent_comment_id AS comment_id, COUNT(*)::int AS cnt
  FROM discussion_comments
  WHERE status = 'visible'
    AND parent_comment_id IS NOT NULL
  GROUP BY parent_comment_id
) AS counts
WHERE c.comment_id = counts.comment_id
  AND c.replies_count IS DISTINCT FROM counts.cnt;

COMMIT;
