-- 0016 — Self-report guard at the DB layer.
--
-- Defense-in-depth against the previous `review.userId === reporterId`
-- application guard being bypassed (the inline check was easy to
-- miss in review and was never tested at the integration layer).
-- Even an admin who created a review must not be able to file a
-- self-report against it: the moderation queue would otherwise
-- pollute itself with self-reports and the moderator dashboard
-- loses signal.
--
-- Why a trigger, not a CHECK constraint
-- --------------------------------------
--
-- Postgres CHECK constraints cannot reference rows in another
-- table — `review_reports.reporter_id` would need to be checked
-- against `quiz_reviews.user_id` for the same `review_id`, which
-- is a cross-table invariant. CHECK constraints are limited to
-- the current row's columns. A BEFORE INSERT trigger is the
-- canonical Postgres mechanism for cross-table invariants on
-- INSERT.
--
-- Behavior under the new trigger
-- ------------------------------
--
-- The trigger raises `23514 (check_violation)` with the custom
-- message "review_reports_self_report_forbidden" when the new
-- row's `reporter_id` matches the parent review's `user_id`.
-- The repository layer translates that error code back into
-- `ReviewValidationError('You cannot report your own review')`
-- so the user-facing response is identical to the
-- application-layer guard's response.
--
-- Idempotency
-- -----------
--
-- Both `DROP TRIGGER IF EXISTS` and `DROP FUNCTION IF EXISTS`
-- are safe to re-run. Operators can rerun this migration on a
-- database that already has the trigger; both DDL statements
-- become no-ops.
--
-- Pre-existing data
-- -----------------
--
-- Today no `review_reports` row has `reporter_id = quiz_reviews.user_id`
-- for the same `review_id`. If a historical row exists, the
-- trigger is added without re-checking existing rows — the
-- constraint is INSERT-only by design (the moderation audit log
-- preserves historical data even when invariants later tighten).

BEGIN;

CREATE OR REPLACE FUNCTION review_reports_reject_self_report()
RETURNS trigger AS $$
DECLARE
  review_author_id uuid;
BEGIN
  SELECT user_id
    INTO review_author_id
    FROM quiz_reviews
   WHERE review_id = NEW.review_id;

  -- The parent review must exist for the report to make sense.
  -- The FK `review_reports_review_id_fkey` would already reject
  -- the insert with `23503` in that case, but checking here keeps
  -- the error message focused on the self-report invariant.
  IF review_author_id IS NULL THEN
    RAISE EXCEPTION 'review_reports_self_report_check: parent review % not found', NEW.review_id
      USING ERRCODE = '23514';
  END IF;

  IF review_author_id = NEW.reporter_id THEN
    RAISE EXCEPTION 'review_reports_self_report_forbidden'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_review_reports_reject_self_report ON review_reports;

CREATE TRIGGER trg_review_reports_reject_self_report
  BEFORE INSERT ON review_reports
  FOR EACH ROW
  EXECUTE FUNCTION review_reports_reject_self_report();

COMMIT;