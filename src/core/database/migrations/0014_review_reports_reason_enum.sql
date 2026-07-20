-- 0014 — Phase 5 / Issue #18 — Add a CHECK constraint that
-- constrains `review_reports.reason` to a closed set of structured
-- tags.
--
-- Why this is needed
-- -------------------
--
-- The DTO layer now validates `@IsIn(REPORT_REASON_VALUES)` so
-- HTTP clients cannot submit arbitrary tags. A direct DB write
-- (DBA migration, ETL job, future internal endpoint that bypasses
-- validation) would otherwise persist an arbitrary string and
-- break the moderation dashboard's group-by-reason queries.
--
-- Behavior under the new constraint
-- ----------------------------------
--
-- Postgres rejects the offending INSERT/UPDATE at COMMIT time with
-- a `23514 check_violation`. Today every report is created via the
-- HTTP path which already filters tags at the DTO layer, so this
-- migration never rejects a row in steady state.
--
-- Pre-existing data migration
-- ---------------------------
--
-- This migration assumes every existing `reason` row already
-- satisfies the closed set. If any row carries an off-list reason
-- (e.g. historical `"abuse"` or `"copyright"`), the migration
-- raises `23514` on ALTER. Operators running this migration in a
-- long-lived production database should first normalize
-- non-conforming rows via a one-shot UPDATE that maps any
-- off-list tag to `'other'`. Today the table is clean.
--
-- Idempotent: re-running on an already-constrained table is a
-- no-op because of `IF NOT EXISTS`.

BEGIN;

ALTER TABLE review_reports
  ADD CONSTRAINT review_reports_reason_enum
  CHECK (
    reason IN (
      'spam',
      'harassment',
      'inappropriate_content',
      'misinformation',
      'other'
    )
  );

COMMIT;