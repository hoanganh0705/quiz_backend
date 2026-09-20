CREATE INDEX "idx_review_reports_status_created_report_id"
ON "review_reports" USING btree ("status" enum_ops, "created_at" timestamptz_ops DESC, "report_id" uuid_ops DESC);--> statement-breakpoint

CREATE INDEX "idx_review_reports_open_queue"
ON "review_reports" USING btree ("created_at" timestamptz_ops DESC, "report_id" uuid_ops DESC)
WHERE "status" = 'open';--> statement-breakpoint
