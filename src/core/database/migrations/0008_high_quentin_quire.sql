DROP INDEX "idx_user_sessions_active";--> statement-breakpoint
CREATE INDEX "idx_user_sessions_active" ON "user_sessions" USING btree ("user_id" uuid_ops) WHERE revoked_at IS NULL;