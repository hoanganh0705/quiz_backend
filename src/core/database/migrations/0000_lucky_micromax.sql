-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TYPE "public"."badge_condition_type" AS ENUM('quizzes_completed', 'quizzes_passed', 'streak_days', 'xp_earned', 'tournaments_won', 'perfect_score');--> statement-breakpoint
CREATE TYPE "public"."badge_type" AS ENUM('diamond', 'platinum', 'gold', 'silver', 'bronze');--> statement-breakpoint
CREATE TYPE "public"."quiz_difficulty" AS ENUM('easy', 'medium', 'hard');--> statement-breakpoint
CREATE TYPE "public"."quiz_instance_status" AS ENUM('open', 'running', 'closed', 'finished');--> statement-breakpoint
CREATE TYPE "public"."quiz_version_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."tournament_round_status" AS ENUM('pending', 'open', 'running', 'finished');--> statement-breakpoint
CREATE TYPE "public"."tournament_status" AS ENUM('upcoming', 'registration', 'ongoing', 'finished', 'cancelled');--> statement-breakpoint
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
CREATE TABLE "users" (
	"user_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" "citext" NOT NULL,
	"email" "citext" NOT NULL,
	"display_name" text,
	"avatar_url" text,
	"bio" text,
	"xp_total" integer DEFAULT 0 NOT NULL,
	"current_streak" integer DEFAULT 0 NOT NULL,
	"longest_streak" integer DEFAULT 0 NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "uq_users_email" UNIQUE("email"),
	CONSTRAINT "uq_users_username" UNIQUE("username"),
	CONSTRAINT "users_email_len" CHECK ((length((email)::text) >= 3) AND (length((email)::text) <= 255)),
	CONSTRAINT "users_email_like" CHECK (POSITION(('@'::text) IN (email)) > 1),
	CONSTRAINT "users_settings_object" CHECK (jsonb_typeof(settings) = 'object'::text),
	CONSTRAINT "users_streak_nonneg" CHECK ((current_streak >= 0) AND (longest_streak >= 0)),
	CONSTRAINT "users_streak_order" CHECK (longest_streak >= current_streak),
	CONSTRAINT "users_username_len" CHECK ((length((username)::text) >= 3) AND (length((username)::text) <= 50)),
	CONSTRAINT "users_xp_nonneg" CHECK (xp_total >= 0)
);
--> statement-breakpoint
CREATE TABLE "user_badges" (
	"user_badge_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"badge_id" uuid NOT NULL,
	"earned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "uq_user_badges_user_badge" UNIQUE("badge_id","user_id"),
	CONSTRAINT "user_badges_metadata_object" CHECK (jsonb_typeof(metadata) = 'object'::text)
);
--> statement-breakpoint
CREATE TABLE "badges" (
	"badge_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"type" "badge_type" NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"condition_type" "badge_condition_type" NOT NULL,
	"condition_value" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_badges_slug" UNIQUE("slug"),
	CONSTRAINT "badges_condition_value_positive" CHECK (condition_value > 0),
	CONSTRAINT "badges_name_nonblank" CHECK (length(btrim(name)) > 0),
	CONSTRAINT "badges_slug_format" CHECK ((slug = lower(slug)) AND (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'::text))
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
CREATE TABLE "quizzes" (
	"quiz_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"slug" text NOT NULL,
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
CREATE TABLE "quiz_categories" (
	"quiz_category_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quiz_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_quiz_categories_pair" UNIQUE("category_id","quiz_id")
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
CREATE TABLE "quiz_stats" (
	"quiz_id" uuid PRIMARY KEY NOT NULL,
	"total_attempts" bigint DEFAULT 0 NOT NULL,
	"total_players" bigint DEFAULT 0 NOT NULL,
	"avg_score_percent" numeric(5, 2) DEFAULT '0' NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quiz_stats_avg_score_percent_range" CHECK ((avg_score_percent >= (0)::numeric) AND (avg_score_percent <= (100)::numeric)),
	CONSTRAINT "quiz_stats_total_attempts_nonneg" CHECK (total_attempts >= 0),
	CONSTRAINT "quiz_stats_total_players_nonneg" CHECK (total_players >= 0)
);
--> statement-breakpoint
CREATE TABLE "quiz_attempts" (
	"attempt_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"quiz_version_id" uuid NOT NULL,
	"context_type" text DEFAULT 'solo' NOT NULL,
	"context_ref_id" uuid,
	"status" text DEFAULT 'started' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"time_taken_ms" integer,
	"xp_earned" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quiz_attempts_status_check" CHECK (status = ANY (ARRAY['started'::text, 'completed'::text, 'abandoned'::text]))
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
CREATE TABLE "quiz_reviews" (
	"review_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quiz_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"rating" smallint NOT NULL,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_quiz_reviews_quiz_user" UNIQUE("quiz_id","user_id"),
	CONSTRAINT "quiz_reviews_rating_range" CHECK ((rating >= 1) AND (rating <= 5))
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
CREATE TABLE "quiz_instance_players" (
	"instance_player_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"instance_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"attempt_id" uuid,
	"status" text DEFAULT 'joined' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"left_at" timestamp with time zone,
	CONSTRAINT "uq_quiz_instance_players_instance_user" UNIQUE("instance_id","user_id"),
	CONSTRAINT "quiz_instance_players_status_check" CHECK (status = ANY (ARRAY['joined'::text, 'ready'::text, 'playing'::text, 'disconnected'::text, 'finished'::text]))
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
CREATE TABLE "tournament_participants" (
	"participant_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"registered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"total_score" integer DEFAULT 0 NOT NULL,
	"total_time_ms" integer DEFAULT 0 NOT NULL,
	"rank_final" smallint,
	"status" text DEFAULT 'active' NOT NULL,
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
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_badge_id_fkey" FOREIGN KEY ("badge_id") REFERENCES "public"."badges"("badge_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_published_version_id_fkey" FOREIGN KEY ("published_version_id") REFERENCES "public"."quiz_versions"("quiz_version_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_versions" ADD CONSTRAINT "quiz_versions_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_versions" ADD CONSTRAINT "quiz_versions_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "public"."quizzes"("quiz_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_quiz_version_id_fkey" FOREIGN KEY ("quiz_version_id") REFERENCES "public"."quiz_versions"("quiz_version_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_answer_options" ADD CONSTRAINT "quiz_answer_options_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."quiz_questions"("question_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_categories" ADD CONSTRAINT "quiz_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("category_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_categories" ADD CONSTRAINT "quiz_categories_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "public"."quizzes"("quiz_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_tags" ADD CONSTRAINT "quiz_tags_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "public"."quizzes"("quiz_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_tags" ADD CONSTRAINT "quiz_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("tag_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_stats" ADD CONSTRAINT "quiz_stats_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "public"."quizzes"("quiz_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_quiz_version_id_fkey" FOREIGN KEY ("quiz_version_id") REFERENCES "public"."quiz_versions"("quiz_version_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempt_answers" ADD CONSTRAINT "quiz_attempt_answers_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "public"."quiz_attempts"("attempt_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempt_answers" ADD CONSTRAINT "quiz_attempt_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."quiz_questions"("question_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempt_answers" ADD CONSTRAINT "quiz_attempt_answers_selected_option_id_fkey" FOREIGN KEY ("selected_option_id") REFERENCES "public"."quiz_answer_options"("option_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempt_events" ADD CONSTRAINT "quiz_attempt_events_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "public"."quiz_attempts"("attempt_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempt_events" ADD CONSTRAINT "quiz_attempt_events_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."quiz_questions"("question_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempt_events" ADD CONSTRAINT "quiz_attempt_events_selected_option_id_fkey" FOREIGN KEY ("selected_option_id") REFERENCES "public"."quiz_answer_options"("option_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_reviews" ADD CONSTRAINT "quiz_reviews_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "public"."quizzes"("quiz_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_reviews" ADD CONSTRAINT "quiz_reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmark_collections" ADD CONSTRAINT "bookmark_collections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmarked_quizzes" ADD CONSTRAINT "bookmarked_quizzes_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "public"."bookmark_collections"("collection_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmarked_quizzes" ADD CONSTRAINT "bookmarked_quizzes_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "public"."quizzes"("quiz_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_instances" ADD CONSTRAINT "quiz_instances_host_user_id_fkey" FOREIGN KEY ("host_user_id") REFERENCES "public"."users"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_instances" ADD CONSTRAINT "quiz_instances_quiz_version_id_fkey" FOREIGN KEY ("quiz_version_id") REFERENCES "public"."quiz_versions"("quiz_version_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_instance_players" ADD CONSTRAINT "quiz_instance_players_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "public"."quiz_attempts"("attempt_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_instance_players" ADD CONSTRAINT "quiz_instance_players_instance_id_fkey" FOREIGN KEY ("instance_id") REFERENCES "public"."quiz_instances"("instance_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_instance_players" ADD CONSTRAINT "quiz_instance_players_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_rounds" ADD CONSTRAINT "tournament_rounds_quiz_version_id_fkey" FOREIGN KEY ("quiz_version_id") REFERENCES "public"."quiz_versions"("quiz_version_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_rounds" ADD CONSTRAINT "tournament_rounds_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("tournament_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("category_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_participants" ADD CONSTRAINT "tournament_participants_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("tournament_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_participants" ADD CONSTRAINT "tournament_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_round_participants" ADD CONSTRAINT "tournament_round_participants_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "public"."quiz_attempts"("attempt_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_round_participants" ADD CONSTRAINT "tournament_round_participants_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "public"."tournament_participants"("participant_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_round_participants" ADD CONSTRAINT "tournament_round_participants_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "public"."tournament_rounds"("round_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_tags_active_created_at" ON "tags" USING btree ("created_at" timestamptz_ops) WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_tags_name_active" ON "tags" USING btree (lower(name) text_ops) WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_tags_slug_active" ON "tags" USING btree ("slug" text_ops) WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE INDEX "idx_users_active_created_at" ON "users" USING btree ("created_at" timestamptz_ops) WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE INDEX "idx_user_badges_badge_id" ON "user_badges" USING btree ("badge_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_user_badges_user_id" ON "user_badges" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_badges_condition_type" ON "badges" USING btree ("condition_type" enum_ops);--> statement-breakpoint
CREATE INDEX "idx_categories_active_created_at" ON "categories" USING btree ("created_at" timestamptz_ops) WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_categories_name_active" ON "categories" USING btree (lower(name) text_ops) WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_categories_slug_active" ON "categories" USING btree ("slug" text_ops) WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE INDEX "idx_quizzes_active_created_at" ON "quizzes" USING btree ("created_at" timestamptz_ops) WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE INDEX "idx_quizzes_creator_active" ON "quizzes" USING btree ("creator_id" uuid_ops) WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE INDEX "idx_quizzes_published_version_id" ON "quizzes" USING btree ("published_version_id" uuid_ops) WHERE (published_version_id IS NOT NULL);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_quizzes_slug_active" ON "quizzes" USING btree ("slug" text_ops) WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE INDEX "idx_quiz_versions_quiz_id" ON "quiz_versions" USING btree ("quiz_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_quiz_answer_options_one_correct" ON "quiz_answer_options" USING btree ("question_id" uuid_ops) WHERE (is_correct = true);--> statement-breakpoint
CREATE INDEX "idx_quiz_categories_category_id" ON "quiz_categories" USING btree ("category_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_quiz_categories_quiz_id" ON "quiz_categories" USING btree ("quiz_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_quiz_tags_quiz_id" ON "quiz_tags" USING btree ("quiz_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_quiz_tags_tag_id" ON "quiz_tags" USING btree ("tag_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_quiz_stats_avg_score_percent_desc" ON "quiz_stats" USING btree ("avg_score_percent" numeric_ops,"quiz_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_quiz_stats_last_attempt_at_desc" ON "quiz_stats" USING btree ("last_attempt_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_quiz_stats_total_attempts_desc" ON "quiz_stats" USING btree ("total_attempts" uuid_ops,"quiz_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_quiz_attempts_quiz_version_id" ON "quiz_attempts" USING btree ("quiz_version_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_quiz_attempts_user_started_at_desc" ON "quiz_attempts" USING btree ("user_id" timestamptz_ops,"started_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_quiz_attempts_user_status" ON "quiz_attempts" USING btree ("user_id" uuid_ops,"status" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_quiz_attempt_answers_attempt_id" ON "quiz_attempt_answers" USING btree ("attempt_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_quiz_attempt_answers_question_id" ON "quiz_attempt_answers" USING btree ("question_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_quiz_attempt_events_attempt_created_at" ON "quiz_attempt_events" USING btree ("attempt_id" timestamptz_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_quiz_reviews_quiz_created_at_desc" ON "quiz_reviews" USING btree ("quiz_id" timestamptz_ops,"created_at" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_quiz_reviews_user_created_at_desc" ON "quiz_reviews" USING btree ("user_id" uuid_ops,"created_at" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_bookmarked_quizzes_collection_id" ON "bookmarked_quizzes" USING btree ("collection_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_bookmarked_quizzes_quiz_id" ON "bookmarked_quizzes" USING btree ("quiz_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_quiz_instances_host_status" ON "quiz_instances" USING btree ("host_user_id" enum_ops,"status" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_quiz_instances_version_status" ON "quiz_instances" USING btree ("quiz_version_id" enum_ops,"status" enum_ops);--> statement-breakpoint
CREATE INDEX "idx_quiz_instance_players_attempt_id" ON "quiz_instance_players" USING btree ("attempt_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_quiz_instance_players_user_id" ON "quiz_instance_players" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_tournament_rounds_quiz_version_id" ON "tournament_rounds" USING btree ("quiz_version_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_tournament_rounds_tournament_status" ON "tournament_rounds" USING btree ("tournament_id" uuid_ops,"status" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_tournaments_category_active" ON "tournaments" USING btree ("category_id" uuid_ops) WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE INDEX "idx_tournaments_status_start_at" ON "tournaments" USING btree ("status" timestamptz_ops,"start_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_tournament_participants_leaderboard" ON "tournament_participants" USING btree ("tournament_id" int4_ops,"total_score" uuid_ops,"total_time_ms" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_tournament_participants_tournament_id" ON "tournament_participants" USING btree ("tournament_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_tournament_participants_user_id" ON "tournament_participants" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_tournament_round_participants_attempt_id" ON "tournament_round_participants" USING btree ("attempt_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_tournament_round_participants_participant_id" ON "tournament_round_participants" USING btree ("participant_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_tournament_round_participants_round_id" ON "tournament_round_participants" USING btree ("round_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_tournament_round_participants_round_leaderboard" ON "tournament_round_participants" USING btree ("round_id" uuid_ops,"round_score" int4_ops,"round_time_ms" uuid_ops);
*/