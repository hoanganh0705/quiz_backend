ALTER TABLE "review_reports" DROP CONSTRAINT "review_reports_reason_nonblank";--> statement-breakpoint
DROP INDEX "idx_quiz_attempts_version_status_created";--> statement-breakpoint
CREATE INDEX "idx_quiz_attempts_version_status_created" ON "quiz_attempts" USING btree ("quiz_version_id" uuid_ops,"status" enum_ops,"created_at" timestamptz_ops);--> statement-breakpoint
ALTER TABLE "review_reports" ADD CONSTRAINT "review_reports_reason_nonblank" CHECK (length(btrim(reason::text)) > 0);