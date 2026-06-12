DROP INDEX "idx_quiz_versions_quiz_status";--> statement-breakpoint
CREATE INDEX "idx_discussion_threads_trending" ON "discussion_threads" USING btree ("votes_count" int4_ops,"created_at" timestamptz_ops) WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_discussion_threads_unanswered" ON "discussion_threads" USING btree ("comments_count" int4_ops,"created_at" timestamptz_ops) WHERE comments_count = 0 AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_quiz_versions_quiz_status" ON "quiz_versions" USING btree ("quiz_id" uuid_ops,"status" enum_ops);