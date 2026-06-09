CREATE TYPE "public"."notification_channel" AS ENUM('in_app', 'email', 'push');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('achievement_earned', 'badge_unlocked', 'rank_achievement', 'rank_improvement', 'period_winner', 'tournament_invite', 'tournament_starting', 'tournament_completed', 'tournament_won', 'streak_milestone', 'friend_request', 'friend_accepted', 'quiz_review_received', 'weekly_summary', 'system_announcement', 'followed', 'discussion_reply', 'discussion_mention', 'discussion_solved', 'badge_earned', 'tournament_started', 'tournament_reminder', 'rank_improved', 'rank_milestone');--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"preferences_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"in_app_enabled" boolean DEFAULT true NOT NULL,
	"email_enabled" boolean DEFAULT true NOT NULL,
	"push_enabled" boolean DEFAULT true NOT NULL,
	"achievement_enabled" boolean DEFAULT true NOT NULL,
	"tournament_enabled" boolean DEFAULT true NOT NULL,
	"rank_enabled" boolean DEFAULT true NOT NULL,
	"friend_enabled" boolean DEFAULT true NOT NULL,
	"discussion_enabled" boolean DEFAULT true NOT NULL,
	"summary_enabled" boolean DEFAULT true NOT NULL,
	"marketing_enabled" boolean DEFAULT false NOT NULL,
	"rank_improvement_threshold" integer DEFAULT 5 NOT NULL,
	"quiet_hours_start" text,
	"quiet_hours_end" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_preferences_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "notification_preferences_threshold_positive" CHECK (rank_improvement_threshold > 0)
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"notification_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "notification_type" NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"channel" "notification_channel" DEFAULT 'in_app' NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "notifications_metadata_object" CHECK (jsonb_typeof(metadata) = 'object'::text)
);
--> statement-breakpoint
ALTER TABLE "discussion_threads" ADD COLUMN "discussion_search_vector" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('simple', coalesce(title, '')), 'A') || setweight(to_tsvector('english', coalesce(body, '')), 'B')) STORED;--> statement-breakpoint
ALTER TABLE "quizzes" ADD COLUMN "quiz_search_vector" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('simple', coalesce(title, '')), 'A') || setweight(to_tsvector('english', coalesce(description, '')), 'B') || setweight(to_tsvector('simple', coalesce(slug, '')), 'A')) STORED;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "user_search_vector" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('simple', coalesce(username, '')), 'A')) STORED;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_notification_preferences_user_id" ON "notification_preferences" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_notifications_user_created" ON "notifications" USING btree ("user_id" uuid_ops,"created_at" timestamptz_ops) WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_notifications_user_unread" ON "notifications" USING btree ("user_id" uuid_ops,"is_read" bool_ops) WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_notifications_user_type" ON "notifications" USING btree ("user_id" uuid_ops,"type" enum_ops) WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_notifications_expires_at" ON "notifications" USING btree ("expires_at" timestamptz_ops) WHERE expires_at IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_discussion_threads_search_vector" ON "discussion_threads" USING gin ("discussion_search_vector") WHERE deleted_at IS NULL AND status = 'open';--> statement-breakpoint
CREATE INDEX "idx_quizzes_search_vector" ON "quizzes" USING gin ("quiz_search_vector") WHERE deleted_at IS NULL AND is_hidden = false;--> statement-breakpoint
CREATE INDEX "idx_users_search_vector" ON "users" USING gin ("user_search_vector") WHERE deleted_at IS NULL;