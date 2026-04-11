ALTER TABLE "user_sessions" ADD COLUMN "jti" uuid;--> statement-breakpoint
UPDATE "user_sessions" SET "jti" = "session_id" WHERE "jti" IS NULL;--> statement-breakpoint
ALTER TABLE "user_sessions" ALTER COLUMN "jti" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_user_sessions_refresh_token_hash" ON "user_sessions" USING btree ("refresh_token_hash" text_ops);--> statement-breakpoint
CREATE INDEX "idx_user_sessions_user_last_used_at" ON "user_sessions" USING btree ("user_id" uuid_ops,"last_used_at" timestamptz_ops);--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "uq_user_sessions_jti" UNIQUE("jti");