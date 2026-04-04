ALTER TABLE "quizzes" DROP CONSTRAINT "quizzes_published_version_id_fkey";
--> statement-breakpoint
DROP INDEX "uq_tags_name_active";--> statement-breakpoint
DROP INDEX "uq_categories_name_active";--> statement-breakpoint
DROP INDEX "idx_quiz_stats_total_attempts_desc";--> statement-breakpoint
DROP INDEX "idx_quiz_attempts_user_started_at_desc";--> statement-breakpoint
DROP INDEX "idx_quiz_attempts_user_status";--> statement-breakpoint
DROP INDEX "idx_quiz_attempt_events_attempt_created_at";--> statement-breakpoint
DROP INDEX "idx_quiz_reviews_quiz_created_at_desc";--> statement-breakpoint
DROP INDEX "idx_quiz_reviews_user_created_at_desc";--> statement-breakpoint
DROP INDEX "idx_quiz_instances_host_status";--> statement-breakpoint
DROP INDEX "idx_quiz_instances_version_status";--> statement-breakpoint
DROP INDEX "idx_tournament_rounds_tournament_status";--> statement-breakpoint
DROP INDEX "idx_tournaments_status_start_at";--> statement-breakpoint
DROP INDEX "idx_tournament_participants_leaderboard";--> statement-breakpoint
DROP INDEX "idx_tournament_round_participants_round_leaderboard";--> statement-breakpoint
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_published_version_id_quiz_versions_quiz_version_id_fk" FOREIGN KEY ("published_version_id") REFERENCES "public"."quiz_versions"("quiz_version_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_tags_name_active" ON "tags" USING btree (lower(name)) WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_categories_name_active" ON "categories" USING btree (lower(name)) WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE INDEX "idx_quiz_stats_total_attempts_desc" ON "quiz_stats" USING btree ("total_attempts" int8_ops,"quiz_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_quiz_attempts_user_started_at_desc" ON "quiz_attempts" USING btree ("user_id" uuid_ops,"started_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_quiz_attempts_user_status" ON "quiz_attempts" USING btree ("user_id" uuid_ops,"status" text_ops);--> statement-breakpoint
CREATE INDEX "idx_quiz_attempt_events_attempt_created_at" ON "quiz_attempt_events" USING btree ("attempt_id" uuid_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_quiz_reviews_quiz_created_at_desc" ON "quiz_reviews" USING btree ("quiz_id" uuid_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_quiz_reviews_user_created_at_desc" ON "quiz_reviews" USING btree ("user_id" uuid_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_quiz_instances_host_status" ON "quiz_instances" USING btree ("host_user_id" uuid_ops,"status" enum_ops);--> statement-breakpoint
CREATE INDEX "idx_quiz_instances_version_status" ON "quiz_instances" USING btree ("quiz_version_id" uuid_ops,"status" enum_ops);--> statement-breakpoint
CREATE INDEX "idx_tournament_rounds_tournament_status" ON "tournament_rounds" USING btree ("tournament_id" uuid_ops,"status" enum_ops);--> statement-breakpoint
CREATE INDEX "idx_tournaments_status_start_at" ON "tournaments" USING btree ("status" enum_ops,"start_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_tournament_participants_leaderboard" ON "tournament_participants" USING btree ("tournament_id" uuid_ops,"total_score" int4_ops,"total_time_ms" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_tournament_round_participants_round_leaderboard" ON "tournament_round_participants" USING btree ("round_id" uuid_ops,"round_score" int4_ops,"round_time_ms" int4_ops);