CREATE TYPE "public"."activity_event_type" AS ENUM('attempt_completed', 'achievement_awarded', 'tournament_joined', 'tournament_completed', 'tournament_won', 'rank_improved', 'rank_milestone', 'streak_milestone');--> statement-breakpoint
CREATE TYPE "public"."badge_category" AS ENUM('quiz', 'xp', 'ranking', 'tournament', 'consistency', 'event', 'special', 'seasonal');--> statement-breakpoint
CREATE TYPE "public"."badge_rule_type" AS ENUM('count', 'rank', 'rank_period', 'streak', 'tournament_win', 'perfect_score', 'xp_total', 'seasonal', 'social');--> statement-breakpoint
CREATE TYPE "public"."badge_type" AS ENUM('diamond', 'platinum', 'gold', 'silver', 'bronze');--> statement-breakpoint
CREATE TYPE "public"."discussion_content_status" AS ENUM('visible', 'hidden', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."discussion_report_status" AS ENUM('open', 'reviewed', 'dismissed', 'actioned');--> statement-breakpoint
CREATE TYPE "public"."discussion_report_target_type" AS ENUM('thread', 'comment', 'reply');--> statement-breakpoint
CREATE TYPE "public"."discussion_thread_status" AS ENUM('open', 'closed', 'hidden', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."discussion_vote_value" AS ENUM('upvote', 'downvote');--> statement-breakpoint
CREATE TYPE "public"."friendship_status" AS ENUM('pending', 'accepted', 'rejected', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('in_app', 'email', 'push');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('achievement_earned', 'badge_unlocked', 'rank_achievement', 'rank_improvement', 'period_winner', 'tournament_invite', 'tournament_starting', 'tournament_completed', 'tournament_won', 'streak_milestone', 'friend_request', 'friend_accepted', 'quiz_review_received', 'weekly_summary', 'system_announcement', 'followed', 'discussion_reply', 'discussion_mention', 'discussion_solved', 'badge_earned', 'badge_revoked', 'tournament_started', 'tournament_reminder', 'rank_improved', 'rank_milestone');--> statement-breakpoint
CREATE TYPE "public"."quiz_difficulty" AS ENUM('easy', 'medium', 'hard');--> statement-breakpoint
CREATE TYPE "public"."quiz_instance_status" AS ENUM('open', 'running', 'closed', 'finished');--> statement-breakpoint
CREATE TYPE "public"."quiz_version_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."review_report_status" AS ENUM('open', 'reviewed', 'dismissed', 'actioned');--> statement-breakpoint
CREATE TYPE "public"."social_feed_activity_type" AS ENUM('badge_earned', 'badge_revoked', 'rank_milestone', 'peak_rank_achieved', 'tournament_joined', 'tournament_completed', 'tournament_won', 'discussion_created', 'discussion_solved');--> statement-breakpoint
CREATE TYPE "public"."tournament_round_status" AS ENUM('pending', 'open', 'running', 'finished');--> statement-breakpoint
CREATE TYPE "public"."tournament_status" AS ENUM('upcoming', 'registration', 'ongoing', 'finished', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'moderator', 'user');--> statement-breakpoint
CREATE TABLE "auth_audit_logs" (
	"audit_log_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"event_type" text NOT NULL,
	"ip_address" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "auth_audit_logs_metadata_object" CHECK (jsonb_typeof(metadata) = 'object'::text)
);
--> statement-breakpoint
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
CREATE TABLE "badges" (
	"badge_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"type" "badge_type" NOT NULL,
	"category" "badge_category" NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"icon_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"version" text DEFAULT '1.0.0' NOT NULL,
	"valid_from" timestamp with time zone,
	"valid_until" timestamp with time zone,
	"evaluation_mode" text DEFAULT 'immediate' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_badges_slug" UNIQUE("slug"),
	CONSTRAINT "badges_name_nonblank" CHECK (length(btrim(name)) > 0),
	CONSTRAINT "badges_slug_format" CHECK ((slug = lower(slug)) AND (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'::text)),
	CONSTRAINT "badges_evaluation_mode_check" CHECK (evaluation_mode = ANY (ARRAY['immediate'::text, 'deferred'::text, 'both'::text]))
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
CREATE TABLE "bookmark_collections" (
	"collection_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_bookmark_collections_user_name" UNIQUE("name","user_id"),
	CONSTRAINT "bookmark_collections_name_nonblank" CHECK (length(btrim(name)) > 0)
);
--> statement-breakpoint
CREATE TABLE "bookmarked_quizzes" (
	"bookmark_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"collection_id" uuid NOT NULL,
	"quiz_id" uuid NOT NULL,
	"bookmarked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_bookmarked_quizzes_pair" UNIQUE("collection_id","quiz_id")
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"category_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"slug" text NOT NULL,
	"image_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "categories_name_nonblank" CHECK (length(btrim(name)) > 0),
	CONSTRAINT "categories_slug_format" CHECK ((slug = lower(slug)) AND (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'::text))
);
--> statement-breakpoint
CREATE TABLE "category_follows" (
	"follow_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
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
CREATE TABLE "discussion_saved_threads" (
	"user_id" uuid NOT NULL,
	"thread_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discussion_thread_subscriptions" (
	"user_id" uuid NOT NULL,
	"thread_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discussion_threads" (
	"thread_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quiz_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"discussion_search_vector" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('simple', coalesce(title, '')), 'A') || setweight(to_tsvector('english', coalesce(body, '')), 'B')) STORED,
	"status" "discussion_thread_status" DEFAULT 'open' NOT NULL,
	"comments_count" integer DEFAULT 0 NOT NULL,
	"votes_count" integer DEFAULT 0 NOT NULL,
	"upvotes_count" integer DEFAULT 0 NOT NULL,
	"downvotes_count" integer DEFAULT 0 NOT NULL,
	"is_solved" boolean DEFAULT false NOT NULL,
	"solved_at" timestamp with time zone,
	"solved_comment_id" uuid,
	"solved_by" uuid,
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
CREATE TABLE "idempotency_keys" (
	"key" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"operation" varchar(64) NOT NULL,
	"response" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
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
CREATE TABLE "oauth_accounts" (
	"oauth_account_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outbox_events" (
	"event_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"aggregate_type" text NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_error" text,
	"idempotency_key" text,
	"failed_at" timestamp with time zone,
	"dlq_reason" text
);
--> statement-breakpoint
CREATE TABLE "password_history" (
	"history_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"password_reset_token_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quiz_answer_options" (
	"option_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"value" text NOT NULL,
	"is_correct" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_quiz_answer_options_question_position" UNIQUE("position","question_id"),
	CONSTRAINT "quiz_answer_options_position_positive" CHECK ("position" > 0),
	CONSTRAINT "quiz_answer_options_value_nonblank" CHECK (length(btrim(value)) > 0)
);
--> statement-breakpoint
CREATE TABLE "quiz_attempt_answers" (
	"attempt_answer_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"selected_option_id" uuid,
	"answered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"time_taken_ms" integer,
	CONSTRAINT "uq_attempt_question" UNIQUE("attempt_id","question_id")
);
--> statement-breakpoint
CREATE TABLE "quiz_attempt_events" (
	"event_id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "quiz_attempt_events_event_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"attempt_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"question_id" uuid,
	"selected_option_id" uuid,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quiz_attempt_events_payload_object" CHECK (jsonb_typeof(payload) = 'object'::text)
);
--> statement-breakpoint
CREATE TABLE "quiz_attempts" (
	"attempt_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"quiz_version_id" uuid NOT NULL,
	"context_type" text DEFAULT 'solo' NOT NULL,
	"context_ref_id" uuid,
	"status" text DEFAULT 'started' NOT NULL,
	"score_percent" numeric(5, 2),
	"correct_count" integer,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"time_taken_ms" integer,
	"xp_earned" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quiz_attempts_status_check" CHECK (status = ANY (ARRAY['started'::text, 'completed'::text, 'abandoned'::text])),
	CONSTRAINT "quiz_attempts_score_percent_range" CHECK (score_percent IS NULL OR (score_percent >= 0 AND score_percent <= 100)),
	CONSTRAINT "quiz_attempts_correct_count_nonneg" CHECK (correct_count IS NULL OR correct_count >= 0)
);
--> statement-breakpoint
CREATE TABLE "quiz_categories" (
	"quiz_category_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quiz_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_quiz_categories_pair" UNIQUE("category_id","quiz_id")
);
--> statement-breakpoint
CREATE TABLE "quiz_instance_players" (
	"instance_player_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"instance_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"attempt_id" uuid,
	"status" text DEFAULT 'joined' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"left_at" timestamp with time zone,
	CONSTRAINT "uq_quiz_instance_players_instance_user" UNIQUE("instance_id","user_id"),
	CONSTRAINT "quiz_instance_players_status_check" CHECK (status = ANY (
        ARRAY[
          'joined'::text,
          'ready'::text,
          'playing'::text,
          'disconnected'::text,
          'finished'::text
        ]
      ))
);
--> statement-breakpoint
CREATE TABLE "quiz_instances" (
	"instance_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quiz_version_id" uuid NOT NULL,
	"host_user_id" uuid NOT NULL,
	"max_players" integer,
	"status" "quiz_instance_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quiz_instances_max_players_positive" CHECK ((max_players IS NULL) OR (max_players > 0)),
	CONSTRAINT "quiz_instances_started_closed_order" CHECK ((started_at IS NULL) OR (closed_at IS NULL) OR (closed_at >= started_at))
);
--> statement-breakpoint
CREATE TABLE "quiz_questions" (
	"question_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quiz_version_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"question_text" text NOT NULL,
	"image_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_quiz_questions_version_position" UNIQUE("position","quiz_version_id"),
	CONSTRAINT "quiz_questions_position_positive" CHECK ("position" > 0),
	CONSTRAINT "quiz_questions_text_nonblank" CHECK (length(btrim(question_text)) > 0)
);
--> statement-breakpoint
CREATE TABLE "quiz_reviews" (
	"review_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quiz_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"rating" smallint NOT NULL,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"helpful_count" smallint DEFAULT 0 NOT NULL,
	CONSTRAINT "uq_quiz_reviews_quiz_user" UNIQUE("quiz_id","user_id"),
	CONSTRAINT "quiz_reviews_rating_range" CHECK ((rating >= 1) AND (rating <= 5))
);
--> statement-breakpoint
CREATE TABLE "quiz_stats" (
	"quiz_id" uuid PRIMARY KEY NOT NULL,
	"total_attempts" bigint DEFAULT 0 NOT NULL,
	"total_players" bigint DEFAULT 0 NOT NULL,
	"avg_score_percent" numeric(5, 2) DEFAULT '0' NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"avg_rating" numeric(3, 2) DEFAULT '0' NOT NULL,
	"rating_count" integer DEFAULT 0 NOT NULL,
	"bookmark_count" integer DEFAULT 0 NOT NULL,
	"completion_rate" numeric(5, 2) DEFAULT '0' NOT NULL,
	"popularity_score" numeric(10, 4) DEFAULT '0' NOT NULL,
	"trending_score" numeric(10, 4) DEFAULT '0' NOT NULL,
	"last_calculated_at" timestamp with time zone,
	CONSTRAINT "quiz_stats_avg_score_percent_range" CHECK ((avg_score_percent >= (0)::numeric) AND (avg_score_percent <= (100)::numeric)),
	CONSTRAINT "quiz_stats_total_attempts_nonneg" CHECK (total_attempts >= 0),
	CONSTRAINT "quiz_stats_total_players_nonneg" CHECK (total_players >= 0),
	CONSTRAINT "quiz_stats_avg_rating_range" CHECK ((avg_rating >= (0)::numeric) AND (avg_rating <= (5)::numeric)),
	CONSTRAINT "quiz_stats_rating_count_nonneg" CHECK (rating_count >= 0),
	CONSTRAINT "quiz_stats_bookmark_count_nonneg" CHECK (bookmark_count >= 0),
	CONSTRAINT "quiz_stats_completion_rate_range" CHECK ((completion_rate >= (0)::numeric) AND (completion_rate <= (100)::numeric))
);
--> statement-breakpoint
CREATE TABLE "quiz_tags" (
	"quiz_tag_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quiz_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_quiz_tags_pair" UNIQUE("quiz_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "quiz_versions" (
	"quiz_version_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quiz_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"status" "quiz_version_status" DEFAULT 'draft' NOT NULL,
	"difficulty" "quiz_difficulty" NOT NULL,
	"duration_ms" integer NOT NULL,
	"passing_score_percent" smallint NOT NULL,
	"reward_xp" integer NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_quiz_versions_quiz_version" UNIQUE("quiz_id","version_number"),
	CONSTRAINT "quiz_versions_duration_ms_positive" CHECK (duration_ms > 0),
	CONSTRAINT "quiz_versions_passing_score_percent_range" CHECK ((passing_score_percent >= 0) AND (passing_score_percent <= 100)),
	CONSTRAINT "quiz_versions_reward_xp_nonneg" CHECK (reward_xp >= 0),
	CONSTRAINT "quiz_versions_version_number_positive" CHECK (version_number > 0)
);
--> statement-breakpoint
CREATE TABLE "quizzes" (
	"quiz_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"slug" text NOT NULL,
	"quiz_search_vector" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('simple', coalesce(title, '')), 'A') || setweight(to_tsvector('english', coalesce(description, '')), 'B') || setweight(to_tsvector('simple', coalesce(slug, '')), 'A')) STORED,
	"requirements" text,
	"image_url" text,
	"is_featured" boolean DEFAULT false NOT NULL,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"published_version_id" uuid,
	CONSTRAINT "quizzes_slug_format" CHECK ((slug = lower(slug)) AND (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'::text)),
	CONSTRAINT "quizzes_title_nonblank" CHECK (length(btrim(title)) > 0)
);
--> statement-breakpoint
CREATE TABLE "rank_history" (
	"history_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"period" text NOT NULL,
	"snapshot_date" timestamp with time zone NOT NULL,
	"rank" integer NOT NULL,
	"xp" integer DEFAULT 0 NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rank_history_period_valid" CHECK (period = ANY (ARRAY['daily'::text, 'weekly'::text, 'monthly'::text, 'all_time'::text]))
);
--> statement-breakpoint
CREATE TABLE "ranking_milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"milestone" text NOT NULL,
	"rank" integer NOT NULL,
	"achieved_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ranking_milestones_rank_positive" CHECK (rank > 0),
	CONSTRAINT "ranking_milestones_milestone_valid" CHECK (milestone = ANY (ARRAY['TOP_10000'::text, 'TOP_1000'::text, 'TOP_100'::text, 'TOP_50'::text, 'TOP_10'::text, 'TOP_3'::text, 'TOP_1'::text]))
);
--> statement-breakpoint
CREATE TABLE "review_helpful_votes" (
	"vote_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_reports" (
	"report_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_id" uuid NOT NULL,
	"reporter_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"details" text,
	"status" "review_report_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_reports_reason_nonblank" CHECK (length(btrim(reason)) > 0)
);
--> statement-breakpoint
CREATE TABLE "social_feed_activities" (
	"activity_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"activity_type" "social_feed_activity_type" NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "social_feed_activities_payload_object" CHECK (jsonb_typeof(payload) = 'object'::text),
	CONSTRAINT "social_feed_activities_payload_not_empty" CHECK (payload <> '{}'::jsonb)
);
--> statement-breakpoint
CREATE TABLE "tag_follows" (
	"follow_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"tag_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "tags_name_nonblank" CHECK (length(btrim(name)) > 0),
	CONSTRAINT "tags_slug_format" CHECK ((slug = lower(slug)) AND (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'::text))
);
--> statement-breakpoint
CREATE TABLE "tournament_participants" (
	"participant_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"registered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"total_score" integer DEFAULT 0 NOT NULL,
	"total_time_ms" integer DEFAULT 0 NOT NULL,
	"rank_final" smallint,
	"status" text DEFAULT 'active' NOT NULL,
	"withdrawn_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_tournament_participants_tournament_user" UNIQUE("tournament_id","user_id"),
	CONSTRAINT "tournament_participants_rank_final_positive" CHECK ((rank_final IS NULL) OR (rank_final > 0)),
	CONSTRAINT "tournament_participants_total_score_nonneg" CHECK (total_score >= 0),
	CONSTRAINT "tournament_participants_total_time_ms_nonneg" CHECK (total_time_ms >= 0)
);
--> statement-breakpoint
CREATE TABLE "tournament_round_participants" (
	"round_participant_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"round_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	"attempt_id" uuid,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"round_score" integer DEFAULT 0 NOT NULL,
	"round_time_ms" integer DEFAULT 0 NOT NULL,
	"rank_in_round" smallint,
	"is_qualified" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_round_participant" UNIQUE("participant_id","round_id"),
	CONSTRAINT "tournament_round_participants_rank_positive" CHECK ((rank_in_round IS NULL) OR (rank_in_round > 0)),
	CONSTRAINT "tournament_round_participants_round_score_nonneg" CHECK (round_score >= 0),
	CONSTRAINT "tournament_round_participants_round_time_ms_nonneg" CHECK (round_time_ms >= 0)
);
--> statement-breakpoint
CREATE TABLE "tournament_rounds" (
	"round_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"round_number" smallint NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"quiz_version_id" uuid NOT NULL,
	"start_at" timestamp with time zone,
	"end_at" timestamp with time zone,
	"duration_ms" integer,
	"status" "tournament_round_status" DEFAULT 'pending' NOT NULL,
	"is_elimination" boolean DEFAULT false NOT NULL,
	"participant_limit" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_tournament_rounds_tournament_round_number" UNIQUE("round_number","tournament_id"),
	CONSTRAINT "tournament_rounds_duration_ms_positive" CHECK ((duration_ms IS NULL) OR (duration_ms > 0)),
	CONSTRAINT "tournament_rounds_name_nonblank" CHECK (length(btrim(name)) > 0),
	CONSTRAINT "tournament_rounds_participant_limit_positive" CHECK ((participant_limit IS NULL) OR (participant_limit > 0)),
	CONSTRAINT "tournament_rounds_round_number_positive" CHECK (round_number > 0),
	CONSTRAINT "tournament_rounds_start_end_order" CHECK ((start_at IS NULL) OR (end_at IS NULL) OR (end_at > start_at))
);
--> statement-breakpoint
CREATE TABLE "tournament_stats" (
	"tournament_id" uuid PRIMARY KEY NOT NULL,
	"participants" integer DEFAULT 0 NOT NULL,
	"completed_participants" integer DEFAULT 0 NOT NULL,
	"average_score" numeric(10, 2) DEFAULT '0',
	"highest_score" integer,
	"lowest_score" integer,
	"completion_rate" numeric(5, 2) DEFAULT '0',
	"average_rank" numeric(10, 2),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tournaments" (
	"tournament_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"difficulty" "quiz_difficulty" NOT NULL,
	"status" "tournament_status" DEFAULT 'upcoming' NOT NULL,
	"prize" text,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"max_participants" integer,
	"category_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "tournaments_max_participants_positive" CHECK ((max_participants IS NULL) OR (max_participants > 0)),
	CONSTRAINT "tournaments_start_end_order" CHECK (end_at > start_at),
	CONSTRAINT "tournaments_title_nonblank" CHECK (length(btrim(title)) > 0)
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
CREATE TABLE "user_badges" (
	"user_badge_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"badge_id" uuid NOT NULL,
	"earned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"badge_version" text DEFAULT '1.0.0' NOT NULL,
	"progress" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"revocation_reason" text,
	CONSTRAINT "user_badges_progress_object" CHECK (jsonb_typeof(progress) = 'object'::text),
	CONSTRAINT "user_badges_metadata_object" CHECK (jsonb_typeof(metadata) = 'object'::text)
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
CREATE TABLE "user_ranking" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"all_time_xp" integer DEFAULT 0 NOT NULL,
	"weekly_xp" integer DEFAULT 0 NOT NULL,
	"monthly_xp" integer DEFAULT 0 NOT NULL,
	"all_time_rank" integer,
	"weekly_rank" integer,
	"monthly_rank" integer,
	"daily_rank" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_weekly_reset_at" timestamp with time zone,
	"last_monthly_reset_at" timestamp with time zone,
	"last_daily_reset_at" timestamp with time zone,
	"peak_all_time_rank" integer,
	"peak_all_time_rank_achieved_at" timestamp with time zone,
	"peak_weekly_rank" integer,
	"peak_weekly_rank_achieved_at" timestamp with time zone,
	"peak_monthly_rank" integer,
	"peak_monthly_rank_achieved_at" timestamp with time zone,
	"peak_daily_rank" integer,
	"peak_daily_rank_achieved_at" timestamp with time zone,
	"daily_xp" integer DEFAULT 0 NOT NULL,
	"last_activity_at" timestamp with time zone,
	"is_dirty" boolean DEFAULT false NOT NULL,
	CONSTRAINT "user_ranking_all_time_xp_nonneg" CHECK (all_time_xp >= 0),
	CONSTRAINT "user_ranking_weekly_xp_nonneg" CHECK (weekly_xp >= 0),
	CONSTRAINT "user_ranking_monthly_xp_nonneg" CHECK (monthly_xp >= 0),
	CONSTRAINT "user_ranking_daily_xp_nonneg" CHECK (daily_xp >= 0),
	CONSTRAINT "user_ranking_all_time_rank_positive" CHECK ((all_time_rank IS NULL) OR (all_time_rank > 0)),
	CONSTRAINT "user_ranking_weekly_rank_positive" CHECK ((weekly_rank IS NULL) OR (weekly_rank > 0)),
	CONSTRAINT "user_ranking_monthly_rank_positive" CHECK ((monthly_rank IS NULL) OR (monthly_rank > 0)),
	CONSTRAINT "user_ranking_daily_rank_positive" CHECK ((daily_rank IS NULL) OR (daily_rank > 0))
);
--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"session_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"jti" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"refresh_token_hash" text NOT NULL,
	"device_browser" text,
	"device_os" text,
	"device_type" text DEFAULT 'unknown' NOT NULL,
	"ip_address" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "uq_user_sessions_jti" UNIQUE("jti")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"user_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"user_search_vector" "tsvector",
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"email_verification_token_hash" text,
	"email_verification_expires_at" timestamp with time zone,
	"email_verified_at" timestamp with time zone,
	"password_changed_at" timestamp with time zone,
	"xp_total" integer DEFAULT 0 NOT NULL,
	"current_streak" integer DEFAULT 0 NOT NULL,
	"longest_streak" integer DEFAULT 0 NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "users_email_len" CHECK ((length((email)::text) >= 3) AND (length((email)::text) <= 255)),
	CONSTRAINT "users_email_like" CHECK (POSITION(('@'::text) IN (email)) > 1),
	CONSTRAINT "users_settings_object" CHECK (jsonb_typeof(settings) = 'object'::text),
	CONSTRAINT "users_streak_nonneg" CHECK ((current_streak >= 0) AND (longest_streak >= 0)),
	CONSTRAINT "users_streak_order" CHECK (longest_streak >= current_streak),
	CONSTRAINT "users_username_len" CHECK ((length((username)::text) >= 3) AND (length((username)::text) <= 50)),
	CONSTRAINT "users_xp_nonneg" CHECK (xp_total >= 0)
);
--> statement-breakpoint
ALTER TABLE "auth_audit_logs" ADD CONSTRAINT "auth_audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "badge_rules" ADD CONSTRAINT "badge_rules_badge_id_fkey" FOREIGN KEY ("badge_id") REFERENCES "public"."badges"("badge_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocked_users" ADD CONSTRAINT "blocked_users_blocker_id_fkey" FOREIGN KEY ("blocker_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocked_users" ADD CONSTRAINT "blocked_users_blocked_id_fkey" FOREIGN KEY ("blocked_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmark_collections" ADD CONSTRAINT "bookmark_collections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmarked_quizzes" ADD CONSTRAINT "bookmarked_quizzes_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "public"."bookmark_collections"("collection_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmarked_quizzes" ADD CONSTRAINT "bookmarked_quizzes_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "public"."quizzes"("quiz_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_follows" ADD CONSTRAINT "category_follows_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_follows" ADD CONSTRAINT "category_follows_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("category_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_comments" ADD CONSTRAINT "discussion_comments_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."discussion_threads"("thread_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_comments" ADD CONSTRAINT "discussion_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_comments" ADD CONSTRAINT "discussion_comments_parent_comment_id_fkey" FOREIGN KEY ("parent_comment_id") REFERENCES "public"."discussion_comments"("comment_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_reports" ADD CONSTRAINT "discussion_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_reports" ADD CONSTRAINT "discussion_reports_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_saved_threads" ADD CONSTRAINT "discussion_saved_threads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_saved_threads" ADD CONSTRAINT "discussion_saved_threads_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."discussion_threads"("thread_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_thread_subscriptions" ADD CONSTRAINT "discussion_thread_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_thread_subscriptions" ADD CONSTRAINT "discussion_thread_subscriptions_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."discussion_threads"("thread_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_threads" ADD CONSTRAINT "discussion_threads_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "public"."quizzes"("quiz_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_threads" ADD CONSTRAINT "discussion_threads_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_threads" ADD CONSTRAINT "discussion_threads_solved_comment_id_fkey" FOREIGN KEY ("solved_comment_id") REFERENCES "public"."discussion_comments"("comment_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_threads" ADD CONSTRAINT "discussion_threads_solved_by_fkey" FOREIGN KEY ("solved_by") REFERENCES "public"."users"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_votes" ADD CONSTRAINT "discussion_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_addressee_id_fkey" FOREIGN KEY ("addressee_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_history" ADD CONSTRAINT "password_history_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_history" ADD CONSTRAINT "password_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_answer_options" ADD CONSTRAINT "quiz_answer_options_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."quiz_questions"("question_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempt_answers" ADD CONSTRAINT "quiz_attempt_answers_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "public"."quiz_attempts"("attempt_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempt_answers" ADD CONSTRAINT "quiz_attempt_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."quiz_questions"("question_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempt_answers" ADD CONSTRAINT "quiz_attempt_answers_selected_option_id_fkey" FOREIGN KEY ("selected_option_id") REFERENCES "public"."quiz_answer_options"("option_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempt_events" ADD CONSTRAINT "quiz_attempt_events_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "public"."quiz_attempts"("attempt_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempt_events" ADD CONSTRAINT "quiz_attempt_events_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."quiz_questions"("question_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempt_events" ADD CONSTRAINT "quiz_attempt_events_selected_option_id_fkey" FOREIGN KEY ("selected_option_id") REFERENCES "public"."quiz_answer_options"("option_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_quiz_version_id_fkey" FOREIGN KEY ("quiz_version_id") REFERENCES "public"."quiz_versions"("quiz_version_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_categories" ADD CONSTRAINT "quiz_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("category_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_categories" ADD CONSTRAINT "quiz_categories_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "public"."quizzes"("quiz_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_instance_players" ADD CONSTRAINT "quiz_instance_players_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "public"."quiz_attempts"("attempt_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_instance_players" ADD CONSTRAINT "quiz_instance_players_instance_id_fkey" FOREIGN KEY ("instance_id") REFERENCES "public"."quiz_instances"("instance_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_instance_players" ADD CONSTRAINT "quiz_instance_players_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_instances" ADD CONSTRAINT "quiz_instances_host_user_id_fkey" FOREIGN KEY ("host_user_id") REFERENCES "public"."users"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_instances" ADD CONSTRAINT "quiz_instances_quiz_version_id_fkey" FOREIGN KEY ("quiz_version_id") REFERENCES "public"."quiz_versions"("quiz_version_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_quiz_version_id_fkey" FOREIGN KEY ("quiz_version_id") REFERENCES "public"."quiz_versions"("quiz_version_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_reviews" ADD CONSTRAINT "quiz_reviews_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "public"."quizzes"("quiz_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_reviews" ADD CONSTRAINT "quiz_reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_stats" ADD CONSTRAINT "quiz_stats_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "public"."quizzes"("quiz_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_tags" ADD CONSTRAINT "quiz_tags_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "public"."quizzes"("quiz_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_tags" ADD CONSTRAINT "quiz_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("tag_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_versions" ADD CONSTRAINT "quiz_versions_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_versions" ADD CONSTRAINT "quiz_versions_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "public"."quizzes"("quiz_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_published_version_id_quiz_versions_quiz_version_id_fk" FOREIGN KEY ("published_version_id") REFERENCES "public"."quiz_versions"("quiz_version_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rank_history" ADD CONSTRAINT "rank_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ranking_milestones" ADD CONSTRAINT "ranking_milestones_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_helpful_votes" ADD CONSTRAINT "review_helpful_votes_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "public"."quiz_reviews"("review_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_helpful_votes" ADD CONSTRAINT "review_helpful_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_reports" ADD CONSTRAINT "review_reports_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "public"."quiz_reviews"("review_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_reports" ADD CONSTRAINT "review_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_feed_activities" ADD CONSTRAINT "social_feed_activities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tag_follows" ADD CONSTRAINT "tag_follows_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tag_follows" ADD CONSTRAINT "tag_follows_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("tag_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_participants" ADD CONSTRAINT "tournament_participants_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("tournament_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_participants" ADD CONSTRAINT "tournament_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_round_participants" ADD CONSTRAINT "tournament_round_participants_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "public"."quiz_attempts"("attempt_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_round_participants" ADD CONSTRAINT "tournament_round_participants_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "public"."tournament_participants"("participant_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_round_participants" ADD CONSTRAINT "tournament_round_participants_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "public"."tournament_rounds"("round_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_rounds" ADD CONSTRAINT "tournament_rounds_quiz_version_id_fkey" FOREIGN KEY ("quiz_version_id") REFERENCES "public"."quiz_versions"("quiz_version_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_rounds" ADD CONSTRAINT "tournament_rounds_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("tournament_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_stats" ADD CONSTRAINT "tournament_stats_tournament_id_tournaments_tournament_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("tournament_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("category_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_activity_events" ADD CONSTRAINT "user_activity_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_badge_id_fkey" FOREIGN KEY ("badge_id") REFERENCES "public"."badges"("badge_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_follows" ADD CONSTRAINT "user_follows_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_follows" ADD CONSTRAINT "user_follows_following_id_fkey" FOREIGN KEY ("following_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profile_settings" ADD CONSTRAINT "user_profile_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_ranking" ADD CONSTRAINT "user_ranking_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_auth_audit_logs_created" ON "auth_audit_logs" USING btree ("created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_auth_audit_logs_expires" ON "auth_audit_logs" USING btree ("expires_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_auth_audit_logs_user_created" ON "auth_audit_logs" USING btree ("user_id" uuid_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_badge_rules_badge_id" ON "badge_rules" USING btree ("badge_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_badge_rules_rule_type" ON "badge_rules" USING btree ("rule_type" enum_ops);--> statement-breakpoint
CREATE INDEX "idx_badge_rules_active_priority" ON "badge_rules" USING btree ("is_active" bool_ops,"priority" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_badges_type" ON "badges" USING btree ("type" enum_ops);--> statement-breakpoint
CREATE INDEX "idx_badges_category" ON "badges" USING btree ("category" enum_ops);--> statement-breakpoint
CREATE INDEX "idx_badges_active" ON "badges" USING btree ("is_active" bool_ops);--> statement-breakpoint
CREATE INDEX "idx_badges_evaluation_mode" ON "badges" USING btree ("evaluation_mode" text_ops);--> statement-breakpoint
CREATE INDEX "idx_blocked_users_blocker" ON "blocked_users" USING btree ("blocker_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_blocked_users_blocked" ON "blocked_users" USING btree ("blocked_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_blocked_users_deleted_at" ON "blocked_users" USING btree ("deleted_at" timestamptz_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_blocked_users_pair" ON "blocked_users" USING btree ("blocker_id" uuid_ops,"blocked_id" uuid_ops) WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_bookmarked_quizzes_collection_id" ON "bookmarked_quizzes" USING btree ("collection_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_bookmarked_quizzes_quiz_id" ON "bookmarked_quizzes" USING btree ("quiz_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_categories_active_created_at" ON "categories" USING btree ("created_at" timestamptz_ops) WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_categories_name_active" ON "categories" USING btree (lower(name)) WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_categories_slug_active" ON "categories" USING btree ("slug" text_ops) WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_category_follows_user_category_active" ON "category_follows" USING btree ("user_id" uuid_ops,"category_id" uuid_ops) WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_category_follows_user_id" ON "category_follows" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_category_follows_category_id" ON "category_follows" USING btree ("category_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_category_follows_deleted_at" ON "category_follows" USING btree ("deleted_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_discussion_comments_thread_created" ON "discussion_comments" USING btree ("thread_id" uuid_ops,"created_at" timestamptz_ops) WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_discussion_comments_parent_created" ON "discussion_comments" USING btree ("parent_comment_id" uuid_ops,"created_at" timestamptz_ops) WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_discussion_comments_author_created" ON "discussion_comments" USING btree ("author_id" uuid_ops,"created_at" timestamptz_ops) WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_discussion_reports_status_created" ON "discussion_reports" USING btree ("status" enum_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_discussion_reports_target" ON "discussion_reports" USING btree ("target_type" enum_ops,"target_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_discussion_reports_reporter_target" ON "discussion_reports" USING btree ("reporter_id" uuid_ops,"target_type" enum_ops,"target_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_discussion_saved_threads_user_thread" ON "discussion_saved_threads" USING btree ("user_id" uuid_ops,"thread_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_discussion_saved_threads_user_created" ON "discussion_saved_threads" USING btree ("user_id" uuid_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_discussion_saved_threads_thread" ON "discussion_saved_threads" USING btree ("thread_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_discussion_thread_subscriptions_user_thread" ON "discussion_thread_subscriptions" USING btree ("user_id" uuid_ops,"thread_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_discussion_thread_subscriptions_user_created" ON "discussion_thread_subscriptions" USING btree ("user_id" uuid_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_discussion_thread_subscriptions_thread" ON "discussion_thread_subscriptions" USING btree ("thread_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_discussion_threads_quiz_created" ON "discussion_threads" USING btree ("quiz_id" uuid_ops,"created_at" timestamptz_ops) WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_discussion_threads_author_created" ON "discussion_threads" USING btree ("author_id" uuid_ops,"created_at" timestamptz_ops) WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_discussion_threads_search_vector" ON "discussion_threads" USING gin ("discussion_search_vector") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_discussion_threads_quiz_author_title_active" ON "discussion_threads" USING btree ("quiz_id" uuid_ops,lower(title)) WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_discussion_votes_user_target" ON "discussion_votes" USING btree ("user_id" uuid_ops,"target_type" enum_ops,"target_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_discussion_votes_target" ON "discussion_votes" USING btree ("target_type" enum_ops,"target_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_friendships_requester" ON "friendships" USING btree ("requester_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_friendships_addressee" ON "friendships" USING btree ("addressee_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_friendships_status" ON "friendships" USING btree ("status" enum_ops);--> statement-breakpoint
CREATE INDEX "idx_friendships_deleted_at" ON "friendships" USING btree ("deleted_at" timestamptz_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_friendships_pair" ON "friendships" USING btree ("requester_id" uuid_ops,"addressee_id" uuid_ops) WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_idempotency_keys_expires_at" ON "idempotency_keys" USING btree ("expires_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_idempotency_keys_user_operation" ON "idempotency_keys" USING btree ("user_id" uuid_ops,"operation" text_ops);--> statement-breakpoint
CREATE INDEX "idx_notification_preferences_user_id" ON "notification_preferences" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_notifications_user_created" ON "notifications" USING btree ("user_id" uuid_ops,"created_at" timestamptz_ops) WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_notifications_user_unread" ON "notifications" USING btree ("user_id" uuid_ops,"is_read" bool_ops) WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_notifications_user_type" ON "notifications" USING btree ("user_id" uuid_ops,"type" enum_ops) WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_notifications_expires_at" ON "notifications" USING btree ("expires_at" timestamptz_ops) WHERE expires_at IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_oauth_accounts_provider_provider_user_id" ON "oauth_accounts" USING btree ("provider" text_ops,"provider_user_id" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_oauth_accounts_user_id_provider" ON "oauth_accounts" USING btree ("user_id" uuid_ops,"provider" text_ops);--> statement-breakpoint
CREATE INDEX "idx_oauth_accounts_user_id" ON "oauth_accounts" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_outbox_events_unprocessed" ON "outbox_events" USING btree ("processed_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_outbox_events_created" ON "outbox_events" USING btree ("created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_outbox_events_next_attempt" ON "outbox_events" USING btree ("processed_at" timestamptz_ops,"next_attempt_at" timestamptz_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_outbox_events_idempotency_unprocessed" ON "outbox_events" USING btree ("idempotency_key" text_ops);--> statement-breakpoint
CREATE INDEX "idx_password_history_user_created" ON "password_history" USING btree ("user_id" uuid_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_password_reset_tokens_user_active" ON "password_reset_tokens" USING btree ("user_id" uuid_ops) WHERE is_active = true AND used_at IS NULL AND revoked_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_password_reset_tokens_hash_active" ON "password_reset_tokens" USING btree ("token_hash" text_ops) WHERE is_active = true AND used_at IS NULL AND revoked_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_quiz_answer_options_one_correct" ON "quiz_answer_options" USING btree ("question_id" uuid_ops) WHERE (is_correct = true);--> statement-breakpoint
CREATE INDEX "idx_quiz_attempt_answers_attempt_id" ON "quiz_attempt_answers" USING btree ("attempt_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_quiz_attempt_answers_question_id" ON "quiz_attempt_answers" USING btree ("question_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_quiz_attempt_events_attempt_created_at" ON "quiz_attempt_events" USING btree ("attempt_id" uuid_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_quiz_attempts_quiz_version_id" ON "quiz_attempts" USING btree ("quiz_version_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_quiz_attempts_user_started_at_desc" ON "quiz_attempts" USING btree ("user_id" uuid_ops,"started_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_quiz_attempts_user_status" ON "quiz_attempts" USING btree ("user_id" uuid_ops,"status" text_ops);--> statement-breakpoint
CREATE INDEX "idx_quiz_attempts_version_status_created" ON "quiz_attempts" USING btree ("quiz_version_id" uuid_ops,"status" text_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_quiz_categories_category_id" ON "quiz_categories" USING btree ("category_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_quiz_categories_category_quiz" ON "quiz_categories" USING btree ("category_id" uuid_ops,"quiz_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_quiz_categories_quiz_id" ON "quiz_categories" USING btree ("quiz_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_quiz_instance_players_attempt_id" ON "quiz_instance_players" USING btree ("attempt_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_quiz_instance_players_user_id" ON "quiz_instance_players" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_quiz_instance_players_instance_status" ON "quiz_instance_players" USING btree ("instance_id" uuid_ops,"status" text_ops);--> statement-breakpoint
CREATE INDEX "idx_quiz_instances_host_status" ON "quiz_instances" USING btree ("host_user_id" uuid_ops,"status" enum_ops);--> statement-breakpoint
CREATE INDEX "idx_quiz_instances_version_status" ON "quiz_instances" USING btree ("quiz_version_id" uuid_ops,"status" enum_ops);--> statement-breakpoint
CREATE INDEX "idx_quiz_reviews_quiz_created_at_desc" ON "quiz_reviews" USING btree ("quiz_id" uuid_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_quiz_reviews_quiz_rating" ON "quiz_reviews" USING btree ("quiz_id" uuid_ops,"rating" int2_ops);--> statement-breakpoint
CREATE INDEX "idx_quiz_reviews_user_created_at_desc" ON "quiz_reviews" USING btree ("user_id" uuid_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_quiz_stats_avg_score_percent_desc" ON "quiz_stats" USING btree ("avg_score_percent" numeric_ops,"quiz_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_quiz_stats_last_attempt_at_desc" ON "quiz_stats" USING btree ("last_attempt_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_quiz_stats_total_attempts_desc" ON "quiz_stats" USING btree ("total_attempts" int8_ops,"quiz_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_quiz_stats_popularity_score_desc" ON "quiz_stats" USING btree ("popularity_score" numeric_ops);--> statement-breakpoint
CREATE INDEX "idx_quiz_stats_trending_score_desc" ON "quiz_stats" USING btree ("trending_score" numeric_ops);--> statement-breakpoint
CREATE INDEX "idx_quiz_tags_quiz_id" ON "quiz_tags" USING btree ("quiz_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_quiz_tags_tag_id" ON "quiz_tags" USING btree ("tag_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_quiz_versions_quiz_id" ON "quiz_versions" USING btree ("quiz_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_quiz_versions_quiz_status" ON "quiz_versions" USING btree ("quiz_id" uuid_ops,"status" text_ops);--> statement-breakpoint
CREATE INDEX "idx_quizzes_active_created_at" ON "quizzes" USING btree ("created_at" timestamptz_ops) WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE INDEX "idx_quizzes_creator_active" ON "quizzes" USING btree ("creator_id" uuid_ops) WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE INDEX "idx_quizzes_published_version_id" ON "quizzes" USING btree ("published_version_id" uuid_ops) WHERE (published_version_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "idx_quizzes_search_vector" ON "quizzes" USING gin ("quiz_search_vector") WHERE deleted_at IS NULL AND is_hidden = false;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_quizzes_slug_active" ON "quizzes" USING btree ("slug" text_ops) WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE INDEX "idx_rank_history_user_id" ON "rank_history" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_rank_history_period" ON "rank_history" USING btree ("period" text_ops);--> statement-breakpoint
CREATE INDEX "idx_rank_history_user_period" ON "rank_history" USING btree ("user_id" uuid_ops,"period" text_ops);--> statement-breakpoint
CREATE INDEX "idx_rank_history_snapshot_date" ON "rank_history" USING btree ("snapshot_date" timestamptz_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_rank_history_user_period_snapshot" ON "rank_history" USING btree ("user_id" uuid_ops,"period" text_ops,"snapshot_date" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_ranking_milestones_user_id" ON "ranking_milestones" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_ranking_milestones_achieved_at" ON "ranking_milestones" USING btree ("achieved_at" timestamptz_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_ranking_milestones_user_milestone" ON "ranking_milestones" USING btree ("user_id" uuid_ops,"milestone" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_review_helpful_votes_review_user" ON "review_helpful_votes" USING btree ("review_id" uuid_ops,"user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_review_helpful_votes_review_id" ON "review_helpful_votes" USING btree ("review_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_review_helpful_votes_user_id" ON "review_helpful_votes" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_review_reports_review_reporter" ON "review_reports" USING btree ("review_id" uuid_ops,"reporter_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_review_reports_status_created" ON "review_reports" USING btree ("status" enum_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_review_reports_review_id" ON "review_reports" USING btree ("review_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_review_reports_reporter_id" ON "review_reports" USING btree ("reporter_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_social_feed_activities_occurred" ON "social_feed_activities" USING btree ("occurred_at" timestamptz_ops,"activity_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_social_feed_activities_user_occurred" ON "social_feed_activities" USING btree ("user_id" uuid_ops,"occurred_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_social_feed_activities_type_occurred" ON "social_feed_activities" USING btree ("activity_type" enum_ops,"occurred_at" timestamptz_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_tag_follows_user_tag_active" ON "tag_follows" USING btree ("user_id" uuid_ops,"tag_id" uuid_ops) WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_tag_follows_user_id" ON "tag_follows" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_tag_follows_tag_id" ON "tag_follows" USING btree ("tag_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_tag_follows_deleted_at" ON "tag_follows" USING btree ("deleted_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_tags_active_created_at" ON "tags" USING btree ("created_at" timestamptz_ops) WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_tags_name_active" ON "tags" USING btree (lower(name)) WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_tags_slug_active" ON "tags" USING btree ("slug" text_ops) WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE INDEX "idx_tournament_participants_leaderboard" ON "tournament_participants" USING btree ("tournament_id" uuid_ops,"total_score" int4_ops,"total_time_ms" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_tournament_participants_tournament_id" ON "tournament_participants" USING btree ("tournament_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_tournament_participants_user_id" ON "tournament_participants" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_tournament_participants_user_rank_final" ON "tournament_participants" USING btree ("user_id" uuid_ops,"rank_final" int2_ops) WHERE rank_final IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_tournament_participants_user_registered" ON "tournament_participants" USING btree ("user_id" uuid_ops,"registered_at" timestamptz_ops,"participant_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_tournament_participants_user_completed" ON "tournament_participants" USING btree ("user_id" uuid_ops,"participant_id" uuid_ops) WHERE rank_final IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_tournament_round_participants_attempt_id" ON "tournament_round_participants" USING btree ("attempt_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_tournament_round_participants_participant_id" ON "tournament_round_participants" USING btree ("participant_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_tournament_round_participants_round_id" ON "tournament_round_participants" USING btree ("round_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_tournament_round_participants_round_leaderboard" ON "tournament_round_participants" USING btree ("round_id" uuid_ops,"round_score" int4_ops,"round_time_ms" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_tournament_rounds_quiz_version_id" ON "tournament_rounds" USING btree ("quiz_version_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_tournament_rounds_tournament_status" ON "tournament_rounds" USING btree ("tournament_id" uuid_ops,"status" enum_ops);--> statement-breakpoint
CREATE INDEX "idx_tournaments_category_active" ON "tournaments" USING btree ("category_id" uuid_ops) WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE INDEX "idx_tournaments_status_start_at" ON "tournaments" USING btree ("status" enum_ops,"start_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_user_activity_events_user_occurred" ON "user_activity_events" USING btree ("user_id" uuid_ops,"occurred_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_user_activity_events_user_type" ON "user_activity_events" USING btree ("user_id" uuid_ops,"eventType" enum_ops);--> statement-breakpoint
CREATE INDEX "idx_user_activity_events_visibility" ON "user_activity_events" USING btree ("visibility" text_ops,"occurred_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_user_activity_events_user_created" ON "user_activity_events" USING btree ("user_id" uuid_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_user_activity_events_cursor_pagination" ON "user_activity_events" USING btree ("user_id" uuid_ops,"created_at" timestamptz_ops,"event_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_user_badges_badge_id" ON "user_badges" USING btree ("badge_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_user_badges_user_id" ON "user_badges" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_user_badges_earned_at" ON "user_badges" USING btree ("earned_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_user_badges_active" ON "user_badges" USING btree ("revoked_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_user_badges_user_active_earned" ON "user_badges" USING btree ("user_id" uuid_ops,"revoked_at" timestamptz_ops,"earned_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_user_badges_user_badge_active" ON "user_badges" USING btree ("user_id" uuid_ops,"badge_id" uuid_ops,"revoked_at" timestamptz_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_user_badges_user_badge_active" ON "user_badges" USING btree ("user_id" uuid_ops,"badge_id" uuid_ops) WHERE "user_badges"."revoked_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_user_badges_user_badge" ON "user_badges" USING btree ("user_id" uuid_ops,"badge_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_user_badges_cursor_pagination" ON "user_badges" USING btree ("user_id" uuid_ops,"revoked_at" timestamptz_ops,"earned_at" timestamptz_ops,"user_badge_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_user_follows_follower" ON "user_follows" USING btree ("follower_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_user_follows_following" ON "user_follows" USING btree ("following_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_user_follows_deleted_at" ON "user_follows" USING btree ("deleted_at" timestamptz_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_user_follows_pair" ON "user_follows" USING btree ("follower_id" uuid_ops,"following_id" uuid_ops) WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_user_profile_settings_user_id" ON "user_profile_settings" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_user_profiles_user_id" ON "user_profiles" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_user_ranking_all_time_rank" ON "user_ranking" USING btree ("all_time_rank" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_user_ranking_weekly_rank" ON "user_ranking" USING btree ("weekly_rank" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_user_ranking_monthly_rank" ON "user_ranking" USING btree ("monthly_rank" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_user_ranking_daily_rank" ON "user_ranking" USING btree ("daily_rank" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_user_ranking_dirty" ON "user_ranking" USING btree ("is_dirty" bool_ops);--> statement-breakpoint
CREATE INDEX "idx_user_ranking_user_dirty_updated" ON "user_ranking" USING btree ("user_id" uuid_ops,"is_dirty" bool_ops,"updated_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_user_sessions_user_id" ON "user_sessions" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_user_sessions_jti_user" ON "user_sessions" USING btree ("jti" uuid_ops,"user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_user_sessions_active" ON "user_sessions" USING btree ("user_id" uuid_ops) WHERE revoked_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_user_sessions_expires_at" ON "user_sessions" USING btree ("expires_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_user_sessions_user_last_used_at" ON "user_sessions" USING btree ("user_id" uuid_ops,"last_used_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_users_active_created_at" ON "users" USING btree ("created_at" timestamptz_ops) WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_users_email_active" ON "users" USING btree ("email" text_ops) WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_users_username_active" ON "users" USING btree ("username" text_ops) WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_users_email_verification_token_active" ON "users" USING btree ("email_verification_token_hash" text_ops) WHERE deleted_at IS NULL AND is_verified = false;--> statement-breakpoint
CREATE INDEX "idx_users_search_vector" ON "users" USING gin ("user_search_vector") WHERE deleted_at IS NULL;