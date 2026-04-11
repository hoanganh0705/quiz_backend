ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "uq_users_email";--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "uq_users_username";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_user_sessions_refresh_token_hash";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_user_sessions_jti_user" ON "user_sessions" USING btree ("jti" uuid_ops,"user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_user_sessions_active" ON "user_sessions" USING btree ("user_id" uuid_ops) WHERE revoked_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_users_email_active" ON "users" USING btree ("email" text_ops) WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_users_username_active" ON "users" USING btree ("username" text_ops) WHERE deleted_at IS NULL;