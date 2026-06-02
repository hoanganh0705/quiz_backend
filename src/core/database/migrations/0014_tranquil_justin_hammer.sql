CREATE TYPE "public"."activity_event_type" AS ENUM('attempt_completed', 'achievement_awarded', 'tournament_joined', 'tournament_completed', 'tournament_won', 'rank_improved', 'rank_milestone', 'streak_milestone');--> statement-breakpoint
CREATE TYPE "public"."badge_category" AS ENUM('quiz', 'xp', 'ranking', 'tournament', 'consistency', 'event', 'special', 'seasonal');--> statement-breakpoint
CREATE TYPE "public"."badge_rule_type" AS ENUM('count', 'rank', 'rank_period', 'streak', 'tournament_win', 'perfect_score', 'xp_total', 'seasonal', 'social');--> statement-breakpoint
CREATE TYPE "public"."discussion_content_status" AS ENUM('visible', 'hidden', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."discussion_report_status" AS ENUM('open', 'reviewed', 'dismissed', 'actioned');--> statement-breakpoint
CREATE TYPE "public"."discussion_report_target_type" AS ENUM('thread', 'comment', 'reply');--> statement-breakpoint
CREATE TYPE "public"."discussion_thread_status" AS ENUM('open', 'closed', 'hidden', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."discussion_vote_value" AS ENUM('upvote', 'downvote');--> statement-breakpoint
CREATE TYPE "public"."friendship_status" AS ENUM('pending', 'accepted', 'rejected', 'blocked');--> statement-breakpoint
CREATE TABLE "badge_rules" (
	"rule_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"badge_id" uuid NOT NULL,
	"rule_type" "badge_rule_type" NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "badge_rules_config_not_null" CHECK (config IS NOT NULL AND jsonb_typeof(config) = 'object')
);
--> statement-breakpoint
CREATE TABLE "blocked_users" (
	"block_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blocker_id" uuid NOT NULL,
	"blocked_id" uuid NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "blocked_users_no_self_block" CHECK (blocker_id != blocked_id)
);
--> statement-breakpoint
CREATE TABLE "discussion_comments" (
	"comment_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"parent_comment_id" uuid,
	"body" text NOT NULL,
	"status" "discussion_content_status" DEFAULT 'visible' NOT NULL,
	"replies_count" integer DEFAULT 0 NOT NULL,
	"votes_count" integer DEFAULT 0 NOT NULL,
	"upvotes_count" integer DEFAULT 0 NOT NULL,
	"downvotes_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "discussion_comments_body_nonblank" CHECK (length(btrim(body)) > 0)
);
--> statement-breakpoint
CREATE TABLE "discussion_reports" (
	"report_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_id" uuid NOT NULL,
	"target_type" "discussion_report_target_type" NOT NULL,
	"target_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"details" text,
	"status" "discussion_report_status" DEFAULT 'open' NOT NULL,
	"reviewed_by_user_id" uuid,
	"reviewed_at" timestamp with time zone,
	"action_taken" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "discussion_reports_reason_nonblank" CHECK (length(btrim(reason)) > 0)
);
--> statement-breakpoint
CREATE TABLE "discussion_threads" (
	"thread_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quiz_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"status" "discussion_thread_status" DEFAULT 'open' NOT NULL,
	"comments_count" integer DEFAULT 0 NOT NULL,
	"votes_count" integer DEFAULT 0 NOT NULL,
	"upvotes_count" integer DEFAULT 0 NOT NULL,
	"downvotes_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "discussion_threads_title_nonblank" CHECK (length(btrim(title)) > 0),
	CONSTRAINT "discussion_threads_body_nonblank" CHECK (length(btrim(body)) > 0)
);
--> statement-breakpoint
CREATE TABLE "discussion_votes" (
	"vote_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"target_type" "discussion_report_target_type" NOT NULL,
	"target_id" uuid NOT NULL,
	"value" "discussion_vote_value" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "friendships" (
	"friendship_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requester_id" uuid NOT NULL,
	"addressee_id" uuid NOT NULL,
	"status" "friendship_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "friendships_no_self_request" CHECK (requester_id != addressee_id)
);
--> statement-breakpoint
CREATE TABLE "rank_history" (
	"history_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"period" text NOT NULL,
	"period_start" timestamp with time zone,
	"period_end" timestamp with time zone,
	"xp_at_start" integer DEFAULT 0 NOT NULL,
	"xp_at_end" integer DEFAULT 0 NOT NULL,
	"rank_at_end" integer,
	"peak_rank" integer,
	"peak_xp" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rank_history_period_valid" CHECK (period = ANY (ARRAY['weekly'::text, 'monthly'::text, 'all_time'::text]))
);
--> statement-breakpoint
CREATE TABLE "user_activity_events" (
	"event_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"eventType" "activity_event_type" NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"visibility" text DEFAULT 'public' NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_activity_events_visibility_check" CHECK (visibility = ANY (ARRAY['public'::text, 'private'::text])),
	CONSTRAINT "user_activity_events_metadata_object" CHECK (jsonb_typeof(metadata) = 'object'::text),
	CONSTRAINT "user_activity_events_metadata_not_empty" CHECK (metadata <> '{}'::jsonb)
);
--> statement-breakpoint
CREATE TABLE "user_follows" (
	"follow_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"follower_id" uuid NOT NULL,
	"following_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "user_follows_no_self_follow" CHECK (follower_id != following_id)
);
--> statement-breakpoint
CREATE TABLE "user_profile_settings" (
	"settings_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"show_statistics" boolean DEFAULT true NOT NULL,
	"show_achievements" boolean DEFAULT true NOT NULL,
	"show_activity" boolean DEFAULT true NOT NULL,
	"show_rank_improvement" boolean DEFAULT true NOT NULL,
	"show_tournament_activity" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_profile_settings_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"profile_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"display_name" text,
	"avatar_url" text,
	"bio" text,
	"tagline" text,
	"pinned_badge_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_profiles_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "user_profiles_display_name_len" CHECK ((display_name IS NULL) OR (length(btrim(display_name)) >= 1 AND length(btrim(display_name)) <= 100)),
	CONSTRAINT "user_profiles_tagline_len" CHECK ((tagline IS NULL) OR (length(btrim(tagline)) <= 160)),
	CONSTRAINT "user_profiles_pinned_badges_array" CHECK (jsonb_typeof(pinned_badge_ids) = 'array')
);
--> statement-breakpoint
ALTER TABLE "badges" DROP CONSTRAINT "badges_condition_value_positive";--> statement-breakpoint
DROP INDEX "idx_badges_condition_type";--> statement-breakpoint
ALTER TABLE "badges" ADD COLUMN "category" "badge_category" NOT NULL;--> statement-breakpoint
ALTER TABLE "badges" ADD COLUMN "icon_url" text;--> statement-breakpoint
ALTER TABLE "badges" ADD COLUMN "is_hidden" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "badges" ADD COLUMN "version" text DEFAULT '1.0.0' NOT NULL;--> statement-breakpoint
ALTER TABLE "badges" ADD COLUMN "valid_from" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "badges" ADD COLUMN "valid_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "badges" ADD COLUMN "evaluation_mode" text DEFAULT 'immediate' NOT NULL;--> statement-breakpoint
ALTER TABLE "quiz_stats" ADD COLUMN "avg_rating" numeric(3, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "quiz_stats" ADD COLUMN "rating_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "quiz_stats" ADD COLUMN "bookmark_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "quiz_stats" ADD COLUMN "completion_rate" numeric(5, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "quiz_stats" ADD COLUMN "popularity_score" numeric(10, 4) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "quiz_stats" ADD COLUMN "trending_score" numeric(10, 4) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "quiz_stats" ADD COLUMN "last_calculated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_badges" ADD COLUMN "badge_version" text DEFAULT '1.0.0' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_badges" ADD COLUMN "progress" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "user_badges" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_badges" ADD COLUMN "revoked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_badges" ADD COLUMN "revocation_reason" text;--> statement-breakpoint
ALTER TABLE "user_ranking" ADD COLUMN "last_weekly_reset_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_ranking" ADD COLUMN "last_monthly_reset_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_ranking" ADD COLUMN "peak_all_time_rank" integer;--> statement-breakpoint
ALTER TABLE "user_ranking" ADD COLUMN "peak_weekly_rank" integer;--> statement-breakpoint
ALTER TABLE "user_ranking" ADD COLUMN "peak_monthly_rank" integer;--> statement-breakpoint
ALTER TABLE "user_ranking" ADD COLUMN "peak_rank_achieved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_ranking" ADD COLUMN "last_activity_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_ranking" ADD COLUMN "is_dirty" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "badge_rules" ADD CONSTRAINT "badge_rules_badge_id_fkey" FOREIGN KEY ("badge_id") REFERENCES "public"."badges"("badge_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocked_users" ADD CONSTRAINT "blocked_users_blocker_id_fkey" FOREIGN KEY ("blocker_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocked_users" ADD CONSTRAINT "blocked_users_blocked_id_fkey" FOREIGN KEY ("blocked_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_comments" ADD CONSTRAINT "discussion_comments_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."discussion_threads"("thread_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_comments" ADD CONSTRAINT "discussion_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_comments" ADD CONSTRAINT "discussion_comments_parent_comment_id_fkey" FOREIGN KEY ("parent_comment_id") REFERENCES "public"."discussion_comments"("comment_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_reports" ADD CONSTRAINT "discussion_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_reports" ADD CONSTRAINT "discussion_reports_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_threads" ADD CONSTRAINT "discussion_threads_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "public"."quizzes"("quiz_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_threads" ADD CONSTRAINT "discussion_threads_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_votes" ADD CONSTRAINT "discussion_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_addressee_id_fkey" FOREIGN KEY ("addressee_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rank_history" ADD CONSTRAINT "rank_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_activity_events" ADD CONSTRAINT "user_activity_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_follows" ADD CONSTRAINT "user_follows_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_follows" ADD CONSTRAINT "user_follows_following_id_fkey" FOREIGN KEY ("following_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profile_settings" ADD CONSTRAINT "user_profile_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_badge_rules_badge_id" ON "badge_rules" USING btree ("badge_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_badge_rules_rule_type" ON "badge_rules" USING btree ("rule_type" enum_ops);--> statement-breakpoint
CREATE INDEX "idx_badge_rules_active_priority" ON "badge_rules" USING btree ("is_active" bool_ops,"priority" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_blocked_users_blocker" ON "blocked_users" USING btree ("blocker_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_blocked_users_blocked" ON "blocked_users" USING btree ("blocked_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_blocked_users_deleted_at" ON "blocked_users" USING btree ("deleted_at" timestamptz_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_blocked_users_pair" ON "blocked_users" USING btree ("blocker_id" uuid_ops,"blocked_id" uuid_ops) WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_discussion_comments_thread_created" ON "discussion_comments" USING btree ("thread_id" uuid_ops,"created_at" timestamptz_ops) WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_discussion_comments_parent_created" ON "discussion_comments" USING btree ("parent_comment_id" uuid_ops,"created_at" timestamptz_ops) WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_discussion_comments_author_created" ON "discussion_comments" USING btree ("author_id" uuid_ops,"created_at" timestamptz_ops) WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_discussion_reports_status_created" ON "discussion_reports" USING btree ("status" enum_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_discussion_reports_target" ON "discussion_reports" USING btree ("target_type" enum_ops,"target_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_discussion_reports_reporter_target" ON "discussion_reports" USING btree ("reporter_id" uuid_ops,"target_type" enum_ops,"target_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_discussion_threads_quiz_created" ON "discussion_threads" USING btree ("quiz_id" uuid_ops,"created_at" timestamptz_ops) WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_discussion_threads_author_created" ON "discussion_threads" USING btree ("author_id" uuid_ops,"created_at" timestamptz_ops) WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_discussion_threads_quiz_author_title_active" ON "discussion_threads" USING btree ("quiz_id" uuid_ops,lower(title)) WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_discussion_votes_user_target" ON "discussion_votes" USING btree ("user_id" uuid_ops,"target_type" enum_ops,"target_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_discussion_votes_target" ON "discussion_votes" USING btree ("target_type" enum_ops,"target_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_friendships_requester" ON "friendships" USING btree ("requester_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_friendships_addressee" ON "friendships" USING btree ("addressee_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_friendships_status" ON "friendships" USING btree ("status" enum_ops);--> statement-breakpoint
CREATE INDEX "idx_friendships_deleted_at" ON "friendships" USING btree ("deleted_at" timestamptz_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_friendships_pair" ON "friendships" USING btree ("requester_id" uuid_ops,"addressee_id" uuid_ops) WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_rank_history_user_id" ON "rank_history" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_rank_history_period" ON "rank_history" USING btree ("period" text_ops);--> statement-breakpoint
CREATE INDEX "idx_rank_history_user_period" ON "rank_history" USING btree ("user_id" uuid_ops,"period" text_ops);--> statement-breakpoint
CREATE INDEX "idx_rank_history_created_at" ON "rank_history" USING btree ("created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_user_activity_events_user_occurred" ON "user_activity_events" USING btree ("user_id" uuid_ops,"occurred_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_user_activity_events_user_type" ON "user_activity_events" USING btree ("user_id" uuid_ops,"eventType" enum_ops);--> statement-breakpoint
CREATE INDEX "idx_user_activity_events_visibility" ON "user_activity_events" USING btree ("visibility" text_ops,"occurred_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_user_follows_follower" ON "user_follows" USING btree ("follower_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_user_follows_following" ON "user_follows" USING btree ("following_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_user_follows_deleted_at" ON "user_follows" USING btree ("deleted_at" timestamptz_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_user_follows_pair" ON "user_follows" USING btree ("follower_id" uuid_ops,"following_id" uuid_ops) WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_user_profile_settings_user_id" ON "user_profile_settings" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_user_profiles_user_id" ON "user_profiles" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_badges_type" ON "badges" USING btree ("type" enum_ops);--> statement-breakpoint
CREATE INDEX "idx_badges_category" ON "badges" USING btree ("category" enum_ops);--> statement-breakpoint
CREATE INDEX "idx_badges_active" ON "badges" USING btree ("is_active" bool_ops);--> statement-breakpoint
CREATE INDEX "idx_badges_evaluation_mode" ON "badges" USING btree ("evaluation_mode" text_ops);--> statement-breakpoint
CREATE INDEX "idx_quiz_stats_popularity_score_desc" ON "quiz_stats" USING btree ("popularity_score" numeric_ops);--> statement-breakpoint
CREATE INDEX "idx_quiz_stats_trending_score_desc" ON "quiz_stats" USING btree ("trending_score" numeric_ops);--> statement-breakpoint
CREATE INDEX "idx_user_badges_earned_at" ON "user_badges" USING btree ("earned_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_user_badges_active" ON "user_badges" USING btree ("revoked_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_user_ranking_dirty" ON "user_ranking" USING btree ("is_dirty" bool_ops);--> statement-breakpoint
ALTER TABLE "badges" DROP COLUMN "condition_type";--> statement-breakpoint
ALTER TABLE "badges" DROP COLUMN "condition_value";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "display_name";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "avatar_url";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "bio";--> statement-breakpoint
ALTER TABLE "badges" ADD CONSTRAINT "badges_evaluation_mode_check" CHECK (evaluation_mode = ANY (ARRAY['immediate'::text, 'deferred'::text, 'both'::text]));--> statement-breakpoint
ALTER TABLE "quiz_stats" ADD CONSTRAINT "quiz_stats_avg_rating_range" CHECK ((avg_rating >= (0)::numeric) AND (avg_rating <= (5)::numeric));--> statement-breakpoint
ALTER TABLE "quiz_stats" ADD CONSTRAINT "quiz_stats_rating_count_nonneg" CHECK (rating_count >= 0);--> statement-breakpoint
ALTER TABLE "quiz_stats" ADD CONSTRAINT "quiz_stats_bookmark_count_nonneg" CHECK (bookmark_count >= 0);--> statement-breakpoint
ALTER TABLE "quiz_stats" ADD CONSTRAINT "quiz_stats_completion_rate_range" CHECK ((completion_rate >= (0)::numeric) AND (completion_rate <= (100)::numeric));--> statement-breakpoint
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_progress_object" CHECK (jsonb_typeof(progress) = 'object'::text);--> statement-breakpoint
DROP TYPE "public"."badge_condition_type";