ALTER TYPE "public"."notification_type" ADD VALUE 'instance_player_joined';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'instance_started';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'instance_xp_earned';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'instance_closed';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'instance_player_disconnected';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'profile_updated';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'settings_updated';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'password_changed';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'password_reset_requested';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'password_reset_completed';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'account_deleted';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'session_revoked';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'all_other_sessions_revoked';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'oauth_linked';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'oauth_unlinked';--> statement-breakpoint
ALTER TYPE "public"."social_feed_activity_type" ADD VALUE 'comment_created' BEFORE 'discussion_created';--> statement-breakpoint
ALTER TABLE "outbox_events" ADD COLUMN "correlation_id" text;--> statement-breakpoint
CREATE INDEX "idx_discussion_threads_status_created" ON "discussion_threads" USING btree ("status" enum_ops,"created_at" timestamptz_ops) WHERE deleted_at IS NULL;