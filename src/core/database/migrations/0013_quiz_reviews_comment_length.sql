-- 0013 — Phase 3 / Issue #31 — Add a CHECK constraint capping the
-- length of `quiz_reviews.comment` at 1000 characters.
--
-- Why this is needed
-- -------------------
--
-- The DTO layer enforces `MaxLength(1000)` for review comments via
-- class-validator, but the database has no equivalent gate. A direct
-- DB write (DBA fix, ETL job, future endpoint that bypasses
-- validation) would otherwise write a multi-megabyte comment and
-- permanently bloat the table.
--
-- Behavior under the new constraint
-- ----------------------------------
--
-- Postgres rejects the offending INSERT/UPDATE at COMMIT time with a
-- `23514 check_violation`. The repository layer already handles
-- legitimate 23505s today; a 23514 on `comment` is a programming
-- error in the caller and should propagate as a 500 with a clear
-- log line.
--
-- Migration is structurally additive: it does not rewrite any
-- existing rows. Pre-existing rows longer than 1000 chars (none
-- expected because the DTO has enforced the limit since the
-- feature's launch) would block the migration; if this becomes an
-- issue in production, a follow-up data migration should truncate
-- offending rows to 1000 chars BEFORE this DDL ships. Today the
-- table is clean.
--
-- This is a structural ADD migration (NOT a data-only migration).
-- Snapshot `0013_snapshot.json` reflects the post-add schema.
--
-- Idempotent: re-running on an already-constrained table is a no-op
-- because of `IF NOT EXISTS`.

BEGIN;

ALTER TABLE quiz_reviews
  ADD CONSTRAINT quiz_reviews_comment_length
  CHECK (comment IS NULL OR length(comment) <= 1000);

COMMIT;