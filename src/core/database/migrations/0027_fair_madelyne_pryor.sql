CREATE INDEX "idx_quiz_attempts_version_status_created" ON "quiz_attempts" USING btree ("quiz_version_id" uuid_ops,"status" text_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_quiz_categories_category_quiz" ON "quiz_categories" USING btree ("category_id" uuid_ops,"quiz_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_quiz_versions_quiz_status" ON "quiz_versions" USING btree ("quiz_id" uuid_ops,"status" text_ops);--> statement-breakpoint
CREATE INDEX "idx_tournament_participants_user_rank_final" ON "tournament_participants" USING btree ("user_id" uuid_ops,"rank_final" int2_ops) WHERE rank_final IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_tournament_participants_user_registered" ON "tournament_participants" USING btree ("user_id" uuid_ops,"registered_at" timestamptz_ops,"participant_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_tournament_participants_user_completed" ON "tournament_participants" USING btree ("user_id" uuid_ops,"participant_id" uuid_ops) WHERE rank_final IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_user_activity_events_user_created" ON "user_activity_events" USING btree ("user_id" uuid_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_user_activity_events_cursor_pagination" ON "user_activity_events" USING btree ("user_id" uuid_ops,"created_at" timestamptz_ops,"event_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_user_badges_user_active_earned" ON "user_badges" USING btree ("user_id" uuid_ops,"revoked_at" timestamptz_ops,"earned_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_user_badges_cursor_pagination" ON "user_badges" USING btree ("user_id" uuid_ops,"revoked_at" timestamptz_ops,"earned_at" timestamptz_ops,"user_badge_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_user_ranking_user_dirty_updated" ON "user_ranking" USING btree ("user_id" uuid_ops,"is_dirty" bool_ops,"updated_at" timestamptz_ops);