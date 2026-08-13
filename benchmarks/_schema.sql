--
-- PostgreSQL database dump
--

\restrict PNRfrzzvRfVUymIBRlbmnRMEbeYPFfSsBJqdMtWITLssljQcQ9hoLzEfe3GE6pV

-- Dumped from database version 18.3 (Debian 18.3-1.pgdg13+1)
-- Dumped by pg_dump version 18.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: drizzle; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA drizzle;


--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS '';


--
-- Name: activity_event_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.activity_event_type AS ENUM (
    'attempt_completed',
    'achievement_awarded',
    'tournament_joined',
    'tournament_completed',
    'tournament_won',
    'rank_improved',
    'rank_milestone',
    'streak_milestone'
);


--
-- Name: badge_category; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.badge_category AS ENUM (
    'quiz',
    'xp',
    'ranking',
    'tournament',
    'consistency',
    'event',
    'special',
    'seasonal'
);


--
-- Name: badge_rule_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.badge_rule_type AS ENUM (
    'count',
    'rank',
    'rank_period',
    'streak',
    'tournament_win',
    'perfect_score',
    'xp_total',
    'seasonal',
    'social'
);


--
-- Name: badge_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.badge_type AS ENUM (
    'diamond',
    'platinum',
    'gold',
    'silver',
    'bronze'
);


--
-- Name: comment_report_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.comment_report_status AS ENUM (
    'open',
    'reviewed',
    'dismissed',
    'actioned'
);


--
-- Name: comment_vote_value; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.comment_vote_value AS ENUM (
    'upvote',
    'downvote'
);


--
-- Name: friendship_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.friendship_status AS ENUM (
    'pending',
    'accepted',
    'rejected',
    'blocked'
);


--
-- Name: notification_channel; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.notification_channel AS ENUM (
    'in_app',
    'email',
    'push'
);


--
-- Name: notification_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.notification_type AS ENUM (
    'achievement_earned',
    'badge_unlocked',
    'rank_achievement',
    'rank_improvement',
    'period_winner',
    'tournament_invite',
    'tournament_starting',
    'tournament_completed',
    'tournament_won',
    'streak_milestone',
    'friend_request',
    'friend_accepted',
    'quiz_review_received',
    'weekly_summary',
    'system_announcement',
    'followed',
    'comment_reply',
    'comment_mention',
    'comment_created',
    'discussion_reply',
    'discussion_mention',
    'discussion_solved',
    'badge_earned',
    'badge_revoked',
    'tournament_started',
    'tournament_reminder',
    'rank_improved',
    'rank_milestone',
    'instance_player_joined',
    'instance_started',
    'instance_xp_earned',
    'instance_closed',
    'instance_player_disconnected',
    'profile_updated',
    'settings_updated',
    'password_changed',
    'password_reset_requested',
    'password_reset_completed',
    'account_deleted',
    'session_revoked',
    'all_other_sessions_revoked',
    'oauth_linked',
    'oauth_unlinked'
);


--
-- Name: quiz_difficulty; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.quiz_difficulty AS ENUM (
    'easy',
    'medium',
    'hard'
);


--
-- Name: quiz_instance_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.quiz_instance_status AS ENUM (
    'open',
    'countdown',
    'running',
    'closed',
    'finished'
);


--
-- Name: quiz_version_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.quiz_version_status AS ENUM (
    'draft',
    'published',
    'archived'
);


--
-- Name: review_report_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.review_report_status AS ENUM (
    'open',
    'reviewed',
    'dismissed',
    'actioned'
);


--
-- Name: social_feed_activity_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.social_feed_activity_type AS ENUM (
    'badge_earned',
    'badge_revoked',
    'rank_milestone',
    'peak_rank_achieved',
    'tournament_joined',
    'tournament_completed',
    'tournament_won',
    'comment_created',
    'discussion_created',
    'discussion_solved',
    'quiz_completed',
    'quiz_milestone',
    'instance_created',
    'instance_joined',
    'instance_completed'
);


--
-- Name: tournament_round_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.tournament_round_status AS ENUM (
    'pending',
    'open',
    'running',
    'finished'
);


--
-- Name: tournament_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.tournament_status AS ENUM (
    'upcoming',
    'registration',
    'ongoing',
    'finished',
    'cancelled'
);


--
-- Name: user_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_role AS ENUM (
    'admin',
    'moderator',
    'user'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: __drizzle_migrations; Type: TABLE; Schema: drizzle; Owner: -
--

CREATE TABLE drizzle.__drizzle_migrations (
    id integer NOT NULL,
    hash text NOT NULL,
    created_at bigint
);


--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE; Schema: drizzle; Owner: -
--

CREATE SEQUENCE drizzle.__drizzle_migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: drizzle; Owner: -
--

ALTER SEQUENCE drizzle.__drizzle_migrations_id_seq OWNED BY drizzle.__drizzle_migrations.id;


--
-- Name: __drizzle_migrations__; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.__drizzle_migrations__ (
    id integer NOT NULL,
    hash text NOT NULL,
    created_at bigint NOT NULL
);


--
-- Name: __drizzle_migrations___id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.__drizzle_migrations___id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: __drizzle_migrations___id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.__drizzle_migrations___id_seq OWNED BY public.__drizzle_migrations__.id;


--
-- Name: auth_audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auth_audit_logs (
    audit_log_id uuid DEFAULT uuidv7() NOT NULL,
    user_id uuid,
    event_type text NOT NULL,
    ip_address text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    CONSTRAINT auth_audit_logs_metadata_object CHECK ((jsonb_typeof(metadata) = 'object'::text))
);


--
-- Name: badge_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.badge_rules (
    rule_id uuid DEFAULT uuidv7() NOT NULL,
    badge_id uuid NOT NULL,
    rule_type public.badge_rule_type NOT NULL,
    priority integer DEFAULT 0 NOT NULL,
    config jsonb DEFAULT '{}'::jsonb CONSTRAINT badge_rules_config_not_null1 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT badge_rules_config_not_null CHECK (((config IS NOT NULL) AND (jsonb_typeof(config) = 'object'::text)))
);


--
-- Name: badges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.badges (
    badge_id uuid DEFAULT uuidv7() NOT NULL,
    slug text NOT NULL,
    type public.badge_type NOT NULL,
    category public.badge_category NOT NULL,
    name text NOT NULL,
    description text,
    icon_url text,
    is_active boolean DEFAULT true NOT NULL,
    is_hidden boolean DEFAULT false NOT NULL,
    version text DEFAULT '1.0.0'::text NOT NULL,
    valid_from timestamp with time zone,
    valid_until timestamp with time zone,
    evaluation_mode text DEFAULT 'immediate'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT badges_evaluation_mode_check CHECK ((evaluation_mode = ANY (ARRAY['immediate'::text, 'deferred'::text, 'both'::text]))),
    CONSTRAINT badges_name_nonblank CHECK ((length(btrim(name)) > 0)),
    CONSTRAINT badges_slug_format CHECK (((slug = lower(slug)) AND (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'::text)))
);


--
-- Name: blocked_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.blocked_users (
    block_id uuid DEFAULT uuidv7() NOT NULL,
    blocker_id uuid NOT NULL,
    blocked_id uuid NOT NULL,
    reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT blocked_users_no_self_block CHECK ((blocker_id <> blocked_id))
);


--
-- Name: bookmark_collections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bookmark_collections (
    collection_id uuid DEFAULT uuidv7() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT bookmark_collections_name_nonblank CHECK ((length(btrim(name)) > 0))
);


--
-- Name: bookmarked_quizzes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bookmarked_quizzes (
    bookmark_id uuid DEFAULT uuidv7() NOT NULL,
    collection_id uuid NOT NULL,
    quiz_id uuid NOT NULL,
    bookmarked_at timestamp with time zone DEFAULT now() NOT NULL,
    notes text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    category_id uuid DEFAULT uuidv7() NOT NULL,
    name text NOT NULL,
    description text,
    slug text NOT NULL,
    image_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT categories_name_nonblank CHECK ((length(btrim(name)) > 0)),
    CONSTRAINT categories_slug_format CHECK (((slug = lower(slug)) AND (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'::text)))
);


--
-- Name: category_follows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.category_follows (
    follow_id uuid DEFAULT uuidv7() NOT NULL,
    user_id uuid NOT NULL,
    category_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: comment_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comment_reports (
    report_id uuid DEFAULT uuidv7() CONSTRAINT discussion_comment_reports_report_id_not_null NOT NULL,
    reporter_id uuid CONSTRAINT discussion_comment_reports_reporter_id_not_null NOT NULL,
    comment_id uuid CONSTRAINT discussion_comment_reports_comment_id_not_null NOT NULL,
    reason text CONSTRAINT discussion_comment_reports_reason_not_null NOT NULL,
    details text,
    status public.comment_report_status DEFAULT 'open'::public.comment_report_status CONSTRAINT discussion_comment_reports_status_not_null NOT NULL,
    reviewed_by_user_id uuid,
    reviewed_at timestamp with time zone,
    action_taken boolean DEFAULT false CONSTRAINT discussion_comment_reports_action_taken_not_null NOT NULL,
    created_at timestamp with time zone DEFAULT now() CONSTRAINT discussion_comment_reports_created_at_not_null NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT discussion_comment_reports_updated_at_not_null NOT NULL,
    CONSTRAINT comment_reports_reason_nonblank CHECK ((length(btrim(reason)) > 0))
);


--
-- Name: comment_votes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comment_votes (
    vote_id uuid DEFAULT uuidv7() CONSTRAINT discussion_comment_votes_vote_id_not_null NOT NULL,
    user_id uuid CONSTRAINT discussion_comment_votes_user_id_not_null NOT NULL,
    comment_id uuid CONSTRAINT discussion_comment_votes_comment_id_not_null NOT NULL,
    value public.comment_vote_value CONSTRAINT discussion_comment_votes_value_not_null NOT NULL,
    created_at timestamp with time zone DEFAULT now() CONSTRAINT discussion_comment_votes_created_at_not_null NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT discussion_comment_votes_updated_at_not_null NOT NULL
);


--
-- Name: comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comments (
    comment_id uuid DEFAULT uuidv7() CONSTRAINT discussion_comments_comment_id_not_null NOT NULL,
    quiz_id uuid CONSTRAINT discussion_comments_quiz_id_not_null NOT NULL,
    author_id uuid CONSTRAINT discussion_comments_author_id_not_null NOT NULL,
    parent_comment_id uuid,
    body text CONSTRAINT discussion_comments_body_not_null NOT NULL,
    is_hidden boolean DEFAULT false CONSTRAINT discussion_comments_is_hidden_not_null NOT NULL,
    hidden_by_id uuid,
    hidden_at timestamp with time zone,
    votes_count integer DEFAULT 0 CONSTRAINT discussion_comments_votes_count_not_null NOT NULL,
    upvotes_count integer DEFAULT 0 CONSTRAINT discussion_comments_upvotes_count_not_null NOT NULL,
    downvotes_count integer DEFAULT 0 CONSTRAINT discussion_comments_downvotes_count_not_null NOT NULL,
    replies_count integer DEFAULT 0 CONSTRAINT discussion_comments_replies_count_not_null NOT NULL,
    created_at timestamp with time zone DEFAULT now() CONSTRAINT discussion_comments_created_at_not_null NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT discussion_comments_updated_at_not_null NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT comments_body_nonblank CHECK ((length(btrim(body)) > 0))
);


--
-- Name: friendships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.friendships (
    friendship_id uuid DEFAULT uuidv7() NOT NULL,
    requester_id uuid NOT NULL,
    addressee_id uuid NOT NULL,
    status public.friendship_status DEFAULT 'pending'::public.friendship_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT friendships_no_self_request CHECK ((requester_id <> addressee_id))
);


--
-- Name: idempotency_keys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.idempotency_keys (
    key character varying(255) NOT NULL,
    user_id uuid NOT NULL,
    operation character varying(64) NOT NULL,
    response jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL
);


--
-- Name: notification_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_preferences (
    preferences_id uuid DEFAULT uuidv7() NOT NULL,
    user_id uuid NOT NULL,
    in_app_enabled boolean DEFAULT true NOT NULL,
    email_enabled boolean DEFAULT true NOT NULL,
    push_enabled boolean DEFAULT true NOT NULL,
    achievement_enabled boolean DEFAULT true NOT NULL,
    tournament_enabled boolean DEFAULT true NOT NULL,
    rank_enabled boolean DEFAULT true NOT NULL,
    friend_enabled boolean DEFAULT true NOT NULL,
    comment_enabled boolean DEFAULT true CONSTRAINT notification_preferences_discussion_enabled_not_null NOT NULL,
    summary_enabled boolean DEFAULT true NOT NULL,
    marketing_enabled boolean DEFAULT false NOT NULL,
    rank_improvement_threshold integer DEFAULT 5 NOT NULL,
    quiet_hours_start text,
    quiet_hours_end text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT notification_preferences_threshold_positive CHECK ((rank_improvement_threshold > 0))
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    notification_id uuid DEFAULT uuidv7() NOT NULL,
    user_id uuid NOT NULL,
    type public.notification_type NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    channel public.notification_channel DEFAULT 'in_app'::public.notification_channel NOT NULL,
    is_read boolean DEFAULT false NOT NULL,
    read_at timestamp with time zone,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT notifications_metadata_object CHECK ((jsonb_typeof(metadata) = 'object'::text))
);


--
-- Name: oauth_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.oauth_accounts (
    oauth_account_id uuid DEFAULT uuidv7() NOT NULL,
    user_id uuid NOT NULL,
    provider text NOT NULL,
    provider_user_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: outbox_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.outbox_events (
    event_id uuid DEFAULT uuidv7() NOT NULL,
    aggregate_type text NOT NULL,
    event_type text NOT NULL,
    payload jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    processed_at timestamp with time zone,
    attempt_count integer DEFAULT 0 NOT NULL,
    last_attempt_at timestamp with time zone,
    next_attempt_at timestamp with time zone DEFAULT now() NOT NULL,
    last_error text,
    idempotency_key text,
    failed_at timestamp with time zone,
    dlq_reason text,
    correlation_id text
);


--
-- Name: password_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.password_history (
    history_id uuid DEFAULT uuidv7() NOT NULL,
    user_id uuid NOT NULL,
    password_hash text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.password_reset_tokens (
    password_reset_token_id uuid DEFAULT uuidv7() NOT NULL,
    user_id uuid NOT NULL,
    token_hash text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: quiz_answer_options; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quiz_answer_options (
    option_id uuid DEFAULT uuidv7() NOT NULL,
    question_id uuid NOT NULL,
    "position" integer NOT NULL,
    value text NOT NULL,
    is_correct boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT quiz_answer_options_position_positive CHECK (("position" > 0)),
    CONSTRAINT quiz_answer_options_value_nonblank CHECK ((length(btrim(value)) > 0))
);


--
-- Name: quiz_attempt_answers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quiz_attempt_answers (
    attempt_answer_id uuid DEFAULT uuidv7() NOT NULL,
    attempt_id uuid NOT NULL,
    question_id uuid NOT NULL,
    selected_option_id uuid,
    answered_at timestamp with time zone DEFAULT now() NOT NULL,
    time_taken_ms integer
);


--
-- Name: quiz_attempt_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quiz_attempt_events (
    event_id bigint NOT NULL,
    attempt_id uuid NOT NULL,
    event_type text NOT NULL,
    question_id uuid,
    selected_option_id uuid,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT quiz_attempt_events_payload_object CHECK ((jsonb_typeof(payload) = 'object'::text))
);


--
-- Name: quiz_attempt_events_event_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.quiz_attempt_events ALTER COLUMN event_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.quiz_attempt_events_event_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: quiz_attempts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quiz_attempts (
    attempt_id uuid DEFAULT uuidv7() NOT NULL,
    user_id uuid NOT NULL,
    quiz_version_id uuid NOT NULL,
    context_type text DEFAULT 'solo'::text NOT NULL,
    context_ref_id uuid,
    status text DEFAULT 'started'::text NOT NULL,
    score_percent numeric(5,2),
    correct_count integer,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    finished_at timestamp with time zone,
    time_taken_ms integer,
    xp_earned integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT quiz_attempts_correct_count_nonneg CHECK (((correct_count IS NULL) OR (correct_count >= 0))),
    CONSTRAINT quiz_attempts_score_percent_range CHECK (((score_percent IS NULL) OR ((score_percent >= (0)::numeric) AND (score_percent <= (100)::numeric)))),
    CONSTRAINT quiz_attempts_status_check CHECK ((status = ANY (ARRAY['started'::text, 'completed'::text, 'abandoned'::text])))
);


--
-- Name: quiz_instance_players; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quiz_instance_players (
    instance_player_id uuid DEFAULT uuidv7() NOT NULL,
    instance_id uuid NOT NULL,
    user_id uuid NOT NULL,
    attempt_id uuid,
    status text DEFAULT 'joined'::text NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL,
    left_at timestamp with time zone,
    CONSTRAINT quiz_instance_players_status_check CHECK ((status = ANY (ARRAY['joined'::text, 'ready'::text, 'playing'::text, 'disconnected'::text, 'finished'::text])))
);


--
-- Name: quiz_instances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quiz_instances (
    instance_id uuid DEFAULT uuidv7() NOT NULL,
    quiz_version_id uuid NOT NULL,
    host_user_id uuid NOT NULL,
    max_players integer,
    status public.quiz_instance_status DEFAULT 'open'::public.quiz_instance_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    started_at timestamp with time zone,
    closed_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    countdown_started_at timestamp with time zone,
    version integer DEFAULT 1 NOT NULL,
    CONSTRAINT quiz_instances_countdown_started_at_consistent CHECK ((((status = 'countdown'::public.quiz_instance_status) AND (countdown_started_at IS NOT NULL)) OR ((status <> 'countdown'::public.quiz_instance_status) AND (countdown_started_at IS NULL)))),
    CONSTRAINT quiz_instances_max_players_positive CHECK (((max_players IS NULL) OR (max_players > 0))),
    CONSTRAINT quiz_instances_started_closed_order CHECK (((started_at IS NULL) OR (closed_at IS NULL) OR (closed_at >= started_at))),
    CONSTRAINT quiz_instances_version_nonneg CHECK ((version >= 0))
);


--
-- Name: quiz_questions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quiz_questions (
    question_id uuid DEFAULT uuidv7() NOT NULL,
    quiz_version_id uuid NOT NULL,
    "position" integer NOT NULL,
    question_text text NOT NULL,
    image_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT quiz_questions_position_positive CHECK (("position" > 0)),
    CONSTRAINT quiz_questions_text_nonblank CHECK ((length(btrim(question_text)) > 0))
);


--
-- Name: quiz_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quiz_reviews (
    review_id uuid DEFAULT uuidv7() NOT NULL,
    quiz_id uuid NOT NULL,
    user_id uuid NOT NULL,
    rating smallint NOT NULL,
    comment text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    helpful_count smallint DEFAULT 0 NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT quiz_reviews_comment_length CHECK (((comment IS NULL) OR (length(comment) <= 1000))),
    CONSTRAINT quiz_reviews_helpful_count_nonneg CHECK ((helpful_count >= 0)),
    CONSTRAINT quiz_reviews_rating_range CHECK (((rating >= 1) AND (rating <= 5)))
);


--
-- Name: quiz_stats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quiz_stats (
    quiz_id uuid NOT NULL,
    total_attempts bigint DEFAULT 0 NOT NULL,
    total_players bigint DEFAULT 0 NOT NULL,
    avg_score_percent numeric(5,2) DEFAULT '0'::numeric NOT NULL,
    last_attempt_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    avg_rating numeric(3,2) DEFAULT '0'::numeric NOT NULL,
    rating_count integer DEFAULT 0 NOT NULL,
    bookmark_count integer DEFAULT 0 NOT NULL,
    completion_rate numeric(5,2) DEFAULT '0'::numeric NOT NULL,
    popularity_score numeric(10,4) DEFAULT '0'::numeric NOT NULL,
    trending_score numeric(10,4) DEFAULT '0'::numeric NOT NULL,
    last_calculated_at timestamp with time zone,
    CONSTRAINT quiz_stats_avg_rating_range CHECK (((avg_rating >= (0)::numeric) AND (avg_rating <= (5)::numeric))),
    CONSTRAINT quiz_stats_avg_score_percent_range CHECK (((avg_score_percent >= (0)::numeric) AND (avg_score_percent <= (100)::numeric))),
    CONSTRAINT quiz_stats_bookmark_count_nonneg CHECK ((bookmark_count >= 0)),
    CONSTRAINT quiz_stats_completion_rate_range CHECK (((completion_rate >= (0)::numeric) AND (completion_rate <= (100)::numeric))),
    CONSTRAINT quiz_stats_rating_count_nonneg CHECK ((rating_count >= 0)),
    CONSTRAINT quiz_stats_total_attempts_nonneg CHECK ((total_attempts >= 0)),
    CONSTRAINT quiz_stats_total_players_nonneg CHECK ((total_players >= 0))
);


--
-- Name: quiz_tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quiz_tags (
    quiz_tag_id uuid DEFAULT uuidv7() NOT NULL,
    quiz_id uuid NOT NULL,
    tag_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: quiz_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quiz_versions (
    quiz_version_id uuid DEFAULT uuidv7() NOT NULL,
    quiz_id uuid NOT NULL,
    version_number integer NOT NULL,
    status public.quiz_version_status DEFAULT 'draft'::public.quiz_version_status NOT NULL,
    difficulty public.quiz_difficulty NOT NULL,
    duration_ms integer NOT NULL,
    passing_score_percent smallint NOT NULL,
    reward_xp integer NOT NULL,
    created_by_user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    published_at timestamp with time zone,
    archived_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT quiz_versions_duration_ms_positive CHECK ((duration_ms > 0)),
    CONSTRAINT quiz_versions_passing_score_percent_range CHECK (((passing_score_percent >= 0) AND (passing_score_percent <= 100))),
    CONSTRAINT quiz_versions_reward_xp_nonneg CHECK ((reward_xp >= 0)),
    CONSTRAINT quiz_versions_version_number_positive CHECK ((version_number > 0))
);


--
-- Name: quizzes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quizzes (
    quiz_id uuid DEFAULT uuidv7() NOT NULL,
    creator_id uuid,
    title text NOT NULL,
    description text,
    slug text NOT NULL,
    quiz_search_vector tsvector GENERATED ALWAYS AS (((setweight(to_tsvector('simple'::regconfig, COALESCE(title, ''::text)), 'A'::"char") || setweight(to_tsvector('english'::regconfig, COALESCE(description, ''::text)), 'B'::"char")) || setweight(to_tsvector('simple'::regconfig, COALESCE(slug, ''::text)), 'A'::"char"))) STORED,
    requirements text,
    image_url text,
    is_featured boolean DEFAULT false NOT NULL,
    is_hidden boolean DEFAULT false NOT NULL,
    is_verified boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    published_version_id uuid,
    category_id uuid,
    CONSTRAINT quizzes_slug_format CHECK (((slug = lower(slug)) AND (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'::text))),
    CONSTRAINT quizzes_title_nonblank CHECK ((length(btrim(title)) > 0))
);


--
-- Name: rank_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rank_history (
    history_id uuid DEFAULT uuidv7() NOT NULL,
    user_id uuid NOT NULL,
    period text NOT NULL,
    snapshot_date timestamp with time zone NOT NULL,
    rank integer NOT NULL,
    xp integer DEFAULT 0 NOT NULL,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT rank_history_period_valid CHECK ((period = ANY (ARRAY['daily'::text, 'weekly'::text, 'monthly'::text, 'all_time'::text])))
);


--
-- Name: rank_recalculation_work_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rank_recalculation_work_items (
    work_item_id uuid DEFAULT uuidv7() NOT NULL,
    user_id uuid NOT NULL,
    period text NOT NULL,
    enqueued_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT rank_recalculation_work_items_period_valid CHECK ((period = ANY (ARRAY['daily'::text, 'weekly'::text, 'monthly'::text, 'all_time'::text])))
);


--
-- Name: ranking_milestones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ranking_milestones (
    id uuid DEFAULT uuidv7() NOT NULL,
    user_id uuid NOT NULL,
    milestone text NOT NULL,
    rank integer NOT NULL,
    achieved_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ranking_milestones_milestone_valid CHECK ((milestone = ANY (ARRAY['TOP_10000'::text, 'TOP_1000'::text, 'TOP_100'::text, 'TOP_50'::text, 'TOP_10'::text, 'TOP_3'::text, 'TOP_1'::text]))),
    CONSTRAINT ranking_milestones_rank_positive CHECK ((rank > 0))
);


--
-- Name: review_helpful_votes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.review_helpful_votes (
    vote_id uuid DEFAULT uuidv7() NOT NULL,
    review_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: review_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.review_reports (
    report_id uuid DEFAULT uuidv7() NOT NULL,
    review_id uuid NOT NULL,
    reporter_id uuid NOT NULL,
    reason text NOT NULL,
    details text,
    status public.review_report_status DEFAULT 'open'::public.review_report_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT review_reports_reason_enum CHECK ((reason = ANY (ARRAY['spam'::text, 'harassment'::text, 'inappropriate_content'::text, 'misinformation'::text, 'other'::text]))),
    CONSTRAINT review_reports_reason_nonblank CHECK ((length(btrim(reason)) > 0))
);


--
-- Name: sent_verification_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sent_verification_tokens (
    sent_token_id uuid DEFAULT uuidv7() NOT NULL,
    user_id uuid,
    token_hash text NOT NULL,
    sent_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL
);


--
-- Name: social_feed_activities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.social_feed_activities (
    activity_id uuid DEFAULT uuidv7() NOT NULL,
    user_id uuid NOT NULL,
    activity_type public.social_feed_activity_type NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT social_feed_activities_payload_not_empty CHECK ((payload <> '{}'::jsonb)),
    CONSTRAINT social_feed_activities_payload_object CHECK ((jsonb_typeof(payload) = 'object'::text))
);


--
-- Name: tag_follows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tag_follows (
    follow_id uuid DEFAULT uuidv7() NOT NULL,
    user_id uuid NOT NULL,
    tag_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tags (
    tag_id uuid DEFAULT uuidv7() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT tags_name_nonblank CHECK ((length(btrim(name)) > 0)),
    CONSTRAINT tags_slug_format CHECK (((slug = lower(slug)) AND (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'::text)))
);


--
-- Name: tournament_participants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tournament_participants (
    participant_id uuid DEFAULT uuidv7() NOT NULL,
    tournament_id uuid NOT NULL,
    user_id uuid NOT NULL,
    registered_at timestamp with time zone DEFAULT now() NOT NULL,
    total_score integer DEFAULT 0 NOT NULL,
    total_time_ms integer DEFAULT 0 NOT NULL,
    rank_final smallint,
    status text DEFAULT 'active'::text NOT NULL,
    withdrawn_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tournament_participants_rank_final_positive CHECK (((rank_final IS NULL) OR (rank_final > 0))),
    CONSTRAINT tournament_participants_total_score_nonneg CHECK ((total_score >= 0)),
    CONSTRAINT tournament_participants_total_time_ms_nonneg CHECK ((total_time_ms >= 0))
);


--
-- Name: tournament_round_participants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tournament_round_participants (
    round_participant_id uuid DEFAULT uuidv7() NOT NULL,
    round_id uuid NOT NULL,
    participant_id uuid NOT NULL,
    attempt_id uuid,
    joined_at timestamp with time zone DEFAULT now() NOT NULL,
    round_score integer DEFAULT 0 NOT NULL,
    round_time_ms integer DEFAULT 0 NOT NULL,
    rank_in_round smallint,
    is_qualified boolean DEFAULT true NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tournament_round_participants_rank_positive CHECK (((rank_in_round IS NULL) OR (rank_in_round > 0))),
    CONSTRAINT tournament_round_participants_round_score_nonneg CHECK ((round_score >= 0)),
    CONSTRAINT tournament_round_participants_round_time_ms_nonneg CHECK ((round_time_ms >= 0))
);


--
-- Name: tournament_rounds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tournament_rounds (
    round_id uuid DEFAULT uuidv7() NOT NULL,
    tournament_id uuid NOT NULL,
    round_number smallint NOT NULL,
    name text NOT NULL,
    description text,
    quiz_version_id uuid NOT NULL,
    start_at timestamp with time zone,
    end_at timestamp with time zone,
    duration_ms integer,
    status public.tournament_round_status DEFAULT 'pending'::public.tournament_round_status NOT NULL,
    is_elimination boolean DEFAULT false NOT NULL,
    participant_limit integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tournament_rounds_duration_ms_positive CHECK (((duration_ms IS NULL) OR (duration_ms > 0))),
    CONSTRAINT tournament_rounds_name_nonblank CHECK ((length(btrim(name)) > 0)),
    CONSTRAINT tournament_rounds_participant_limit_positive CHECK (((participant_limit IS NULL) OR (participant_limit > 0))),
    CONSTRAINT tournament_rounds_round_number_positive CHECK ((round_number > 0)),
    CONSTRAINT tournament_rounds_start_end_order CHECK (((start_at IS NULL) OR (end_at IS NULL) OR (end_at > start_at)))
);


--
-- Name: tournament_stats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tournament_stats (
    tournament_id uuid NOT NULL,
    participants integer DEFAULT 0 NOT NULL,
    completed_participants integer DEFAULT 0 NOT NULL,
    average_score numeric(10,2) DEFAULT '0'::numeric,
    highest_score integer,
    lowest_score integer,
    completion_rate numeric(5,2) DEFAULT '0'::numeric,
    average_rank numeric(10,2),
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tournaments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tournaments (
    tournament_id uuid DEFAULT uuidv7() NOT NULL,
    title text NOT NULL,
    description text,
    difficulty public.quiz_difficulty NOT NULL,
    status public.tournament_status DEFAULT 'upcoming'::public.tournament_status NOT NULL,
    prize text,
    start_at timestamp with time zone NOT NULL,
    end_at timestamp with time zone NOT NULL,
    max_participants integer,
    category_id uuid,
    owner_user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT tournaments_max_participants_positive CHECK (((max_participants IS NULL) OR (max_participants > 0))),
    CONSTRAINT tournaments_start_end_order CHECK ((end_at > start_at)),
    CONSTRAINT tournaments_title_nonblank CHECK ((length(btrim(title)) > 0))
);


--
-- Name: user_activity_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_activity_events (
    event_id uuid DEFAULT uuidv7() NOT NULL,
    user_id uuid NOT NULL,
    "eventType" public.activity_event_type NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    visibility text DEFAULT 'public'::text NOT NULL,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_activity_events_metadata_not_empty CHECK ((metadata <> '{}'::jsonb)),
    CONSTRAINT user_activity_events_metadata_object CHECK ((jsonb_typeof(metadata) = 'object'::text)),
    CONSTRAINT user_activity_events_visibility_check CHECK ((visibility = ANY (ARRAY['public'::text, 'private'::text])))
);


--
-- Name: user_badges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_badges (
    user_badge_id uuid DEFAULT uuidv7() NOT NULL,
    user_id uuid NOT NULL,
    badge_id uuid NOT NULL,
    earned_at timestamp with time zone DEFAULT now() NOT NULL,
    badge_version text DEFAULT '1.0.0'::text NOT NULL,
    progress jsonb DEFAULT '{}'::jsonb NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    expires_at timestamp with time zone,
    revoked_at timestamp with time zone,
    revocation_reason text,
    CONSTRAINT user_badges_metadata_object CHECK ((jsonb_typeof(metadata) = 'object'::text)),
    CONSTRAINT user_badges_progress_object CHECK ((jsonb_typeof(progress) = 'object'::text))
);


--
-- Name: user_follows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_follows (
    follow_id uuid DEFAULT uuidv7() NOT NULL,
    follower_id uuid NOT NULL,
    following_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT user_follows_no_self_follow CHECK ((follower_id <> following_id))
);


--
-- Name: user_profile_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_profile_settings (
    settings_id uuid DEFAULT uuidv7() NOT NULL,
    user_id uuid NOT NULL,
    is_public boolean DEFAULT true NOT NULL,
    show_statistics boolean DEFAULT true NOT NULL,
    show_achievements boolean DEFAULT true NOT NULL,
    show_activity boolean DEFAULT true NOT NULL,
    show_rank_improvement boolean DEFAULT true NOT NULL,
    show_tournament_activity boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_profiles (
    profile_id uuid DEFAULT uuidv7() NOT NULL,
    user_id uuid NOT NULL,
    display_name text,
    avatar_url text,
    bio text,
    tagline text,
    pinned_badge_ids jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_profiles_display_name_len CHECK (((display_name IS NULL) OR ((length(btrim(display_name)) >= 1) AND (length(btrim(display_name)) <= 100)))),
    CONSTRAINT user_profiles_pinned_badges_array CHECK ((jsonb_typeof(pinned_badge_ids) = 'array'::text)),
    CONSTRAINT user_profiles_tagline_len CHECK (((tagline IS NULL) OR (length(btrim(tagline)) <= 160)))
);


--
-- Name: user_ranking; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_ranking (
    user_id uuid NOT NULL,
    all_time_xp integer DEFAULT 0 NOT NULL,
    weekly_xp integer DEFAULT 0 NOT NULL,
    monthly_xp integer DEFAULT 0 NOT NULL,
    all_time_rank integer,
    weekly_rank integer,
    monthly_rank integer,
    daily_rank integer,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_weekly_reset_at timestamp with time zone,
    last_monthly_reset_at timestamp with time zone,
    last_daily_reset_at timestamp with time zone,
    peak_all_time_rank integer,
    peak_all_time_rank_achieved_at timestamp with time zone,
    peak_weekly_rank integer,
    peak_weekly_rank_achieved_at timestamp with time zone,
    peak_monthly_rank integer,
    peak_monthly_rank_achieved_at timestamp with time zone,
    peak_daily_rank integer,
    peak_daily_rank_achieved_at timestamp with time zone,
    daily_xp integer DEFAULT 0 NOT NULL,
    last_activity_at timestamp with time zone,
    is_dirty boolean DEFAULT false NOT NULL,
    CONSTRAINT user_ranking_all_time_rank_positive CHECK (((all_time_rank IS NULL) OR (all_time_rank > 0))),
    CONSTRAINT user_ranking_all_time_xp_nonneg CHECK ((all_time_xp >= 0)),
    CONSTRAINT user_ranking_daily_rank_positive CHECK (((daily_rank IS NULL) OR (daily_rank > 0))),
    CONSTRAINT user_ranking_daily_xp_nonneg CHECK ((daily_xp >= 0)),
    CONSTRAINT user_ranking_monthly_rank_positive CHECK (((monthly_rank IS NULL) OR (monthly_rank > 0))),
    CONSTRAINT user_ranking_monthly_xp_nonneg CHECK ((monthly_xp >= 0)),
    CONSTRAINT user_ranking_weekly_rank_positive CHECK (((weekly_rank IS NULL) OR (weekly_rank > 0))),
    CONSTRAINT user_ranking_weekly_xp_nonneg CHECK ((weekly_xp >= 0))
);


--
-- Name: user_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_sessions (
    session_id uuid DEFAULT uuidv7() NOT NULL,
    jti uuid NOT NULL,
    user_id uuid NOT NULL,
    refresh_token_hash text NOT NULL,
    device_browser text,
    device_os text,
    device_type text DEFAULT 'unknown'::text NOT NULL,
    ip_address text,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_used_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    user_id uuid DEFAULT uuidv7() NOT NULL,
    username text NOT NULL,
    user_search_vector tsvector,
    email text NOT NULL,
    password_hash text NOT NULL,
    role public.user_role DEFAULT 'user'::public.user_role NOT NULL,
    is_verified boolean DEFAULT false NOT NULL,
    email_verification_token_hash text,
    email_verification_expires_at timestamp with time zone,
    email_verified_at timestamp with time zone,
    password_changed_at timestamp with time zone,
    current_streak integer DEFAULT 0 NOT NULL,
    longest_streak integer DEFAULT 0 NOT NULL,
    last_streak_day date,
    settings jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT users_email_len CHECK (((length(email) >= 3) AND (length(email) <= 255))),
    CONSTRAINT users_email_like CHECK ((POSITION(('@'::text) IN (email)) > 1)),
    CONSTRAINT users_settings_object CHECK ((jsonb_typeof(settings) = 'object'::text)),
    CONSTRAINT users_streak_day_not_future CHECK (((last_streak_day IS NULL) OR (last_streak_day <= CURRENT_DATE))),
    CONSTRAINT users_streak_nonneg CHECK (((current_streak >= 0) AND (longest_streak >= 0))),
    CONSTRAINT users_streak_order CHECK ((longest_streak >= current_streak)),
    CONSTRAINT users_username_len CHECK (((length(username) >= 3) AND (length(username) <= 50)))
);


--
-- Name: __drizzle_migrations id; Type: DEFAULT; Schema: drizzle; Owner: -
--

ALTER TABLE ONLY drizzle.__drizzle_migrations ALTER COLUMN id SET DEFAULT nextval('drizzle.__drizzle_migrations_id_seq'::regclass);


--
-- Name: __drizzle_migrations__ id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.__drizzle_migrations__ ALTER COLUMN id SET DEFAULT nextval('public.__drizzle_migrations___id_seq'::regclass);


--
-- Name: __drizzle_migrations __drizzle_migrations_pkey; Type: CONSTRAINT; Schema: drizzle; Owner: -
--

ALTER TABLE ONLY drizzle.__drizzle_migrations
    ADD CONSTRAINT __drizzle_migrations_pkey PRIMARY KEY (id);


--
-- Name: __drizzle_migrations__ __drizzle_migrations___pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.__drizzle_migrations__
    ADD CONSTRAINT __drizzle_migrations___pkey PRIMARY KEY (id);


--
-- Name: auth_audit_logs auth_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_audit_logs
    ADD CONSTRAINT auth_audit_logs_pkey PRIMARY KEY (audit_log_id);


--
-- Name: badge_rules badge_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.badge_rules
    ADD CONSTRAINT badge_rules_pkey PRIMARY KEY (rule_id);


--
-- Name: badges badges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.badges
    ADD CONSTRAINT badges_pkey PRIMARY KEY (badge_id);


--
-- Name: blocked_users blocked_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blocked_users
    ADD CONSTRAINT blocked_users_pkey PRIMARY KEY (block_id);


--
-- Name: bookmark_collections bookmark_collections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookmark_collections
    ADD CONSTRAINT bookmark_collections_pkey PRIMARY KEY (collection_id);


--
-- Name: bookmarked_quizzes bookmarked_quizzes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookmarked_quizzes
    ADD CONSTRAINT bookmarked_quizzes_pkey PRIMARY KEY (bookmark_id);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (category_id);


--
-- Name: category_follows category_follows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category_follows
    ADD CONSTRAINT category_follows_pkey PRIMARY KEY (follow_id);


--
-- Name: comment_reports discussion_comment_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comment_reports
    ADD CONSTRAINT discussion_comment_reports_pkey PRIMARY KEY (report_id);


--
-- Name: comment_votes discussion_comment_votes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comment_votes
    ADD CONSTRAINT discussion_comment_votes_pkey PRIMARY KEY (vote_id);


--
-- Name: comments discussion_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT discussion_comments_pkey PRIMARY KEY (comment_id);


--
-- Name: friendships friendships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.friendships
    ADD CONSTRAINT friendships_pkey PRIMARY KEY (friendship_id);


--
-- Name: idempotency_keys idempotency_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.idempotency_keys
    ADD CONSTRAINT idempotency_keys_pkey PRIMARY KEY (key);


--
-- Name: notification_preferences notification_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_pkey PRIMARY KEY (preferences_id);


--
-- Name: notification_preferences notification_preferences_user_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_user_id_unique UNIQUE (user_id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (notification_id);


--
-- Name: oauth_accounts oauth_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oauth_accounts
    ADD CONSTRAINT oauth_accounts_pkey PRIMARY KEY (oauth_account_id);


--
-- Name: outbox_events outbox_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outbox_events
    ADD CONSTRAINT outbox_events_pkey PRIMARY KEY (event_id);


--
-- Name: password_history password_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_history
    ADD CONSTRAINT password_history_pkey PRIMARY KEY (history_id);


--
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (password_reset_token_id);


--
-- Name: quiz_answer_options quiz_answer_options_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_answer_options
    ADD CONSTRAINT quiz_answer_options_pkey PRIMARY KEY (option_id);


--
-- Name: quiz_attempt_answers quiz_attempt_answers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_attempt_answers
    ADD CONSTRAINT quiz_attempt_answers_pkey PRIMARY KEY (attempt_answer_id);


--
-- Name: quiz_attempt_events quiz_attempt_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_attempt_events
    ADD CONSTRAINT quiz_attempt_events_pkey PRIMARY KEY (event_id);


--
-- Name: quiz_attempts quiz_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_attempts
    ADD CONSTRAINT quiz_attempts_pkey PRIMARY KEY (attempt_id);


--
-- Name: quiz_instance_players quiz_instance_players_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_instance_players
    ADD CONSTRAINT quiz_instance_players_pkey PRIMARY KEY (instance_player_id);


--
-- Name: quiz_instances quiz_instances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_instances
    ADD CONSTRAINT quiz_instances_pkey PRIMARY KEY (instance_id);


--
-- Name: quiz_questions quiz_questions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_questions
    ADD CONSTRAINT quiz_questions_pkey PRIMARY KEY (question_id);


--
-- Name: quiz_reviews quiz_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_reviews
    ADD CONSTRAINT quiz_reviews_pkey PRIMARY KEY (review_id);


--
-- Name: quiz_stats quiz_stats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_stats
    ADD CONSTRAINT quiz_stats_pkey PRIMARY KEY (quiz_id);


--
-- Name: quiz_tags quiz_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_tags
    ADD CONSTRAINT quiz_tags_pkey PRIMARY KEY (quiz_tag_id);


--
-- Name: quiz_versions quiz_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_versions
    ADD CONSTRAINT quiz_versions_pkey PRIMARY KEY (quiz_version_id);


--
-- Name: quizzes quizzes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quizzes
    ADD CONSTRAINT quizzes_pkey PRIMARY KEY (quiz_id);


--
-- Name: rank_history rank_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rank_history
    ADD CONSTRAINT rank_history_pkey PRIMARY KEY (history_id);


--
-- Name: rank_recalculation_work_items rank_recalculation_work_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rank_recalculation_work_items
    ADD CONSTRAINT rank_recalculation_work_items_pkey PRIMARY KEY (work_item_id);


--
-- Name: ranking_milestones ranking_milestones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ranking_milestones
    ADD CONSTRAINT ranking_milestones_pkey PRIMARY KEY (id);


--
-- Name: review_helpful_votes review_helpful_votes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_helpful_votes
    ADD CONSTRAINT review_helpful_votes_pkey PRIMARY KEY (vote_id);


--
-- Name: review_reports review_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_reports
    ADD CONSTRAINT review_reports_pkey PRIMARY KEY (report_id);


--
-- Name: sent_verification_tokens sent_verification_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sent_verification_tokens
    ADD CONSTRAINT sent_verification_tokens_pkey PRIMARY KEY (sent_token_id);


--
-- Name: social_feed_activities social_feed_activities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_feed_activities
    ADD CONSTRAINT social_feed_activities_pkey PRIMARY KEY (activity_id);


--
-- Name: tag_follows tag_follows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tag_follows
    ADD CONSTRAINT tag_follows_pkey PRIMARY KEY (follow_id);


--
-- Name: tags tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT tags_pkey PRIMARY KEY (tag_id);


--
-- Name: tournament_participants tournament_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_participants
    ADD CONSTRAINT tournament_participants_pkey PRIMARY KEY (participant_id);


--
-- Name: tournament_round_participants tournament_round_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_round_participants
    ADD CONSTRAINT tournament_round_participants_pkey PRIMARY KEY (round_participant_id);


--
-- Name: tournament_rounds tournament_rounds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_rounds
    ADD CONSTRAINT tournament_rounds_pkey PRIMARY KEY (round_id);


--
-- Name: tournament_stats tournament_stats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_stats
    ADD CONSTRAINT tournament_stats_pkey PRIMARY KEY (tournament_id);


--
-- Name: tournaments tournaments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournaments
    ADD CONSTRAINT tournaments_pkey PRIMARY KEY (tournament_id);


--
-- Name: quiz_attempt_answers uq_attempt_question; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_attempt_answers
    ADD CONSTRAINT uq_attempt_question UNIQUE (attempt_id, question_id);


--
-- Name: badges uq_badges_slug; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.badges
    ADD CONSTRAINT uq_badges_slug UNIQUE (slug);


--
-- Name: bookmark_collections uq_bookmark_collections_user_name; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookmark_collections
    ADD CONSTRAINT uq_bookmark_collections_user_name UNIQUE (name, user_id);


--
-- Name: bookmarked_quizzes uq_bookmarked_quizzes_pair; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookmarked_quizzes
    ADD CONSTRAINT uq_bookmarked_quizzes_pair UNIQUE (collection_id, quiz_id);


--
-- Name: quiz_answer_options uq_quiz_answer_options_question_position; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_answer_options
    ADD CONSTRAINT uq_quiz_answer_options_question_position UNIQUE ("position", question_id);


--
-- Name: quiz_instance_players uq_quiz_instance_players_instance_user; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_instance_players
    ADD CONSTRAINT uq_quiz_instance_players_instance_user UNIQUE (instance_id, user_id);


--
-- Name: quiz_questions uq_quiz_questions_version_position; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_questions
    ADD CONSTRAINT uq_quiz_questions_version_position UNIQUE ("position", quiz_version_id);


--
-- Name: quiz_reviews uq_quiz_reviews_quiz_user; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_reviews
    ADD CONSTRAINT uq_quiz_reviews_quiz_user UNIQUE (quiz_id, user_id);


--
-- Name: quiz_tags uq_quiz_tags_pair; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_tags
    ADD CONSTRAINT uq_quiz_tags_pair UNIQUE (quiz_id, tag_id);


--
-- Name: quiz_versions uq_quiz_versions_quiz_version; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_versions
    ADD CONSTRAINT uq_quiz_versions_quiz_version UNIQUE (quiz_id, version_number);


--
-- Name: tournament_round_participants uq_round_participant; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_round_participants
    ADD CONSTRAINT uq_round_participant UNIQUE (participant_id, round_id);


--
-- Name: tournament_participants uq_tournament_participants_tournament_user; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_participants
    ADD CONSTRAINT uq_tournament_participants_tournament_user UNIQUE (tournament_id, user_id);


--
-- Name: tournament_rounds uq_tournament_rounds_tournament_round_number; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_rounds
    ADD CONSTRAINT uq_tournament_rounds_tournament_round_number UNIQUE (round_number, tournament_id);


--
-- Name: user_sessions uq_user_sessions_jti; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT uq_user_sessions_jti UNIQUE (jti);


--
-- Name: user_activity_events user_activity_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_activity_events
    ADD CONSTRAINT user_activity_events_pkey PRIMARY KEY (event_id);


--
-- Name: user_badges user_badges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_badges
    ADD CONSTRAINT user_badges_pkey PRIMARY KEY (user_badge_id);


--
-- Name: user_follows user_follows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_follows
    ADD CONSTRAINT user_follows_pkey PRIMARY KEY (follow_id);


--
-- Name: user_profile_settings user_profile_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profile_settings
    ADD CONSTRAINT user_profile_settings_pkey PRIMARY KEY (settings_id);


--
-- Name: user_profile_settings user_profile_settings_user_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profile_settings
    ADD CONSTRAINT user_profile_settings_user_id_unique UNIQUE (user_id);


--
-- Name: user_profiles user_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_pkey PRIMARY KEY (profile_id);


--
-- Name: user_profiles user_profiles_user_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_user_id_unique UNIQUE (user_id);


--
-- Name: user_ranking user_ranking_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_ranking
    ADD CONSTRAINT user_ranking_pkey PRIMARY KEY (user_id);


--
-- Name: user_sessions user_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_pkey PRIMARY KEY (session_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (user_id);


--
-- Name: idx_auth_audit_logs_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auth_audit_logs_created ON public.auth_audit_logs USING btree (created_at);


--
-- Name: idx_auth_audit_logs_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auth_audit_logs_expires ON public.auth_audit_logs USING btree (expires_at);


--
-- Name: idx_auth_audit_logs_user_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auth_audit_logs_user_created ON public.auth_audit_logs USING btree (user_id, created_at);


--
-- Name: idx_badge_rules_active_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_badge_rules_active_priority ON public.badge_rules USING btree (is_active, priority);


--
-- Name: idx_badge_rules_badge_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_badge_rules_badge_id ON public.badge_rules USING btree (badge_id);


--
-- Name: idx_badge_rules_rule_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_badge_rules_rule_type ON public.badge_rules USING btree (rule_type);


--
-- Name: idx_badges_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_badges_active ON public.badges USING btree (is_active);


--
-- Name: idx_badges_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_badges_category ON public.badges USING btree (category);


--
-- Name: idx_badges_evaluation_mode; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_badges_evaluation_mode ON public.badges USING btree (evaluation_mode);


--
-- Name: idx_badges_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_badges_type ON public.badges USING btree (type);


--
-- Name: idx_blocked_users_blocked; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blocked_users_blocked ON public.blocked_users USING btree (blocked_id);


--
-- Name: idx_blocked_users_blocker; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blocked_users_blocker ON public.blocked_users USING btree (blocker_id);


--
-- Name: idx_blocked_users_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blocked_users_deleted_at ON public.blocked_users USING btree (deleted_at);


--
-- Name: idx_bookmarked_quizzes_collection_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookmarked_quizzes_collection_id ON public.bookmarked_quizzes USING btree (collection_id);


--
-- Name: idx_bookmarked_quizzes_quiz_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookmarked_quizzes_quiz_id ON public.bookmarked_quizzes USING btree (quiz_id);


--
-- Name: idx_categories_active_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_categories_active_created_at ON public.categories USING btree (created_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_category_follows_category_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_category_follows_category_id ON public.category_follows USING btree (category_id);


--
-- Name: idx_category_follows_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_category_follows_deleted_at ON public.category_follows USING btree (deleted_at);


--
-- Name: idx_category_follows_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_category_follows_user_id ON public.category_follows USING btree (user_id);


--
-- Name: idx_comment_reports_comment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comment_reports_comment ON public.comment_reports USING btree (comment_id);


--
-- Name: idx_comment_reports_status_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comment_reports_status_created ON public.comment_reports USING btree (status, created_at);


--
-- Name: idx_comment_votes_comment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comment_votes_comment ON public.comment_votes USING btree (comment_id);


--
-- Name: idx_comments_author_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comments_author_created ON public.comments USING btree (author_id, created_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_comments_parent_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comments_parent_created ON public.comments USING btree (parent_comment_id, created_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_comments_quiz_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comments_quiz_created ON public.comments USING btree (quiz_id, created_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_comments_quiz_parent_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comments_quiz_parent_created ON public.comments USING btree (quiz_id, parent_comment_id, created_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_friendships_addressee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_friendships_addressee ON public.friendships USING btree (addressee_id);


--
-- Name: idx_friendships_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_friendships_deleted_at ON public.friendships USING btree (deleted_at);


--
-- Name: idx_friendships_requester; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_friendships_requester ON public.friendships USING btree (requester_id);


--
-- Name: idx_friendships_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_friendships_status ON public.friendships USING btree (status);


--
-- Name: idx_idempotency_keys_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_idempotency_keys_expires_at ON public.idempotency_keys USING btree (expires_at);


--
-- Name: idx_idempotency_keys_user_operation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_idempotency_keys_user_operation ON public.idempotency_keys USING btree (user_id, operation);


--
-- Name: idx_notification_preferences_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_preferences_user_id ON public.notification_preferences USING btree (user_id);


--
-- Name: idx_notifications_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_expires_at ON public.notifications USING btree (expires_at) WHERE (expires_at IS NOT NULL);


--
-- Name: idx_notifications_metadata; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_metadata ON public.notifications USING gin (metadata);


--
-- Name: idx_notifications_user_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user_created ON public.notifications USING btree (user_id, created_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_notifications_user_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user_type ON public.notifications USING btree (user_id, type) WHERE (deleted_at IS NULL);


--
-- Name: idx_notifications_user_unread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user_unread ON public.notifications USING btree (user_id, is_read) WHERE (deleted_at IS NULL);


--
-- Name: idx_oauth_accounts_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_oauth_accounts_user_id ON public.oauth_accounts USING btree (user_id);


--
-- Name: idx_outbox_events_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_outbox_events_created ON public.outbox_events USING btree (created_at);


--
-- Name: idx_outbox_events_idempotency_unprocessed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_outbox_events_idempotency_unprocessed ON public.outbox_events USING btree (idempotency_key);


--
-- Name: idx_outbox_events_next_attempt; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_outbox_events_next_attempt ON public.outbox_events USING btree (processed_at, next_attempt_at, created_at);


--
-- Name: idx_outbox_events_unprocessed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_outbox_events_unprocessed ON public.outbox_events USING btree (processed_at);


--
-- Name: idx_password_history_user_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_password_history_user_created ON public.password_history USING btree (user_id, created_at);


--
-- Name: idx_password_reset_tokens_hash_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_password_reset_tokens_hash_active ON public.password_reset_tokens USING btree (token_hash) WHERE ((is_active = true) AND (used_at IS NULL) AND (revoked_at IS NULL));


--
-- Name: idx_password_reset_tokens_user_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_password_reset_tokens_user_active ON public.password_reset_tokens USING btree (user_id) WHERE ((is_active = true) AND (used_at IS NULL) AND (revoked_at IS NULL));


--
-- Name: idx_quiz_attempt_answers_attempt_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quiz_attempt_answers_attempt_id ON public.quiz_attempt_answers USING btree (attempt_id);


--
-- Name: idx_quiz_attempt_answers_question_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quiz_attempt_answers_question_id ON public.quiz_attempt_answers USING btree (question_id);


--
-- Name: idx_quiz_attempt_events_attempt_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quiz_attempt_events_attempt_created_at ON public.quiz_attempt_events USING btree (attempt_id, created_at);


--
-- Name: idx_quiz_attempts_quiz_version_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quiz_attempts_quiz_version_id ON public.quiz_attempts USING btree (quiz_version_id);


--
-- Name: idx_quiz_attempts_user_started_at_desc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quiz_attempts_user_started_at_desc ON public.quiz_attempts USING btree (user_id, started_at);


--
-- Name: idx_quiz_attempts_user_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quiz_attempts_user_status ON public.quiz_attempts USING btree (user_id, status);


--
-- Name: idx_quiz_attempts_version_status_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quiz_attempts_version_status_created ON public.quiz_attempts USING btree (quiz_version_id, status, created_at);


--
-- Name: idx_quiz_instance_players_attempt_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quiz_instance_players_attempt_id ON public.quiz_instance_players USING btree (attempt_id);


--
-- Name: idx_quiz_instance_players_instance_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quiz_instance_players_instance_status ON public.quiz_instance_players USING btree (instance_id, status);


--
-- Name: idx_quiz_instance_players_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quiz_instance_players_user_id ON public.quiz_instance_players USING btree (user_id);


--
-- Name: idx_quiz_instances_countdown_due; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quiz_instances_countdown_due ON public.quiz_instances USING btree (countdown_started_at) WHERE (status = 'countdown'::public.quiz_instance_status);


--
-- Name: idx_quiz_instances_host_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quiz_instances_host_status ON public.quiz_instances USING btree (host_user_id, status);


--
-- Name: idx_quiz_instances_version_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quiz_instances_version_status ON public.quiz_instances USING btree (quiz_version_id, status);


--
-- Name: idx_quiz_reviews_active_created_at_desc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quiz_reviews_active_created_at_desc ON public.quiz_reviews USING btree (quiz_id, created_at DESC NULLS LAST) WHERE (deleted_at IS NULL);


--
-- Name: idx_quiz_reviews_active_helpful_count_desc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quiz_reviews_active_helpful_count_desc ON public.quiz_reviews USING btree (helpful_count DESC NULLS LAST, review_id DESC NULLS LAST) WHERE (deleted_at IS NULL);


--
-- Name: idx_quiz_reviews_quiz_created_at_desc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quiz_reviews_quiz_created_at_desc ON public.quiz_reviews USING btree (quiz_id, created_at);


--
-- Name: idx_quiz_reviews_quiz_rating; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quiz_reviews_quiz_rating ON public.quiz_reviews USING btree (quiz_id, rating);


--
-- Name: idx_quiz_reviews_user_created_at_desc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quiz_reviews_user_created_at_desc ON public.quiz_reviews USING btree (user_id, created_at);


--
-- Name: idx_quiz_stats_avg_score_percent_desc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quiz_stats_avg_score_percent_desc ON public.quiz_stats USING btree (avg_score_percent, quiz_id);


--
-- Name: idx_quiz_stats_last_attempt_at_desc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quiz_stats_last_attempt_at_desc ON public.quiz_stats USING btree (last_attempt_at);


--
-- Name: idx_quiz_stats_popularity_score_desc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quiz_stats_popularity_score_desc ON public.quiz_stats USING btree (popularity_score);


--
-- Name: idx_quiz_stats_total_attempts_desc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quiz_stats_total_attempts_desc ON public.quiz_stats USING btree (total_attempts, quiz_id);


--
-- Name: idx_quiz_stats_trending_score_desc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quiz_stats_trending_score_desc ON public.quiz_stats USING btree (trending_score);


--
-- Name: idx_quiz_tags_quiz_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quiz_tags_quiz_id ON public.quiz_tags USING btree (quiz_id);


--
-- Name: idx_quiz_tags_tag_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quiz_tags_tag_id ON public.quiz_tags USING btree (tag_id);


--
-- Name: idx_quiz_versions_quiz_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quiz_versions_quiz_id ON public.quiz_versions USING btree (quiz_id);


--
-- Name: idx_quiz_versions_quiz_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quiz_versions_quiz_status ON public.quiz_versions USING btree (quiz_id, status);


--
-- Name: idx_quizzes_active_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quizzes_active_created_at ON public.quizzes USING btree (created_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_quizzes_category_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quizzes_category_id ON public.quizzes USING btree (category_id) WHERE (category_id IS NOT NULL);


--
-- Name: idx_quizzes_creator_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quizzes_creator_active ON public.quizzes USING btree (creator_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_quizzes_published_version_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quizzes_published_version_id ON public.quizzes USING btree (published_version_id) WHERE (published_version_id IS NOT NULL);


--
-- Name: idx_quizzes_search_vector; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quizzes_search_vector ON public.quizzes USING gin (quiz_search_vector) WHERE ((deleted_at IS NULL) AND (is_hidden = false));


--
-- Name: idx_rank_history_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rank_history_period ON public.rank_history USING btree (period);


--
-- Name: idx_rank_history_snapshot_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rank_history_snapshot_date ON public.rank_history USING btree (snapshot_date);


--
-- Name: idx_rank_history_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rank_history_user_id ON public.rank_history USING btree (user_id);


--
-- Name: idx_rank_history_user_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rank_history_user_period ON public.rank_history USING btree (user_id, period);


--
-- Name: idx_rank_recalculation_work_items_enqueued; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rank_recalculation_work_items_enqueued ON public.rank_recalculation_work_items USING btree (enqueued_at);


--
-- Name: idx_ranking_milestones_achieved_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ranking_milestones_achieved_at ON public.ranking_milestones USING btree (achieved_at);


--
-- Name: idx_ranking_milestones_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ranking_milestones_user_id ON public.ranking_milestones USING btree (user_id);


--
-- Name: idx_review_helpful_votes_review_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_review_helpful_votes_review_id ON public.review_helpful_votes USING btree (review_id);


--
-- Name: idx_review_helpful_votes_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_review_helpful_votes_user_id ON public.review_helpful_votes USING btree (user_id);


--
-- Name: idx_review_reports_reporter_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_review_reports_reporter_id ON public.review_reports USING btree (reporter_id);


--
-- Name: idx_review_reports_review_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_review_reports_review_id ON public.review_reports USING btree (review_id);


--
-- Name: idx_review_reports_status_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_review_reports_status_created ON public.review_reports USING btree (status, created_at);


--
-- Name: idx_sent_verification_tokens_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sent_verification_tokens_expires ON public.sent_verification_tokens USING btree (expires_at);


--
-- Name: idx_social_feed_activities_occurred; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_social_feed_activities_occurred ON public.social_feed_activities USING btree (occurred_at, activity_id);


--
-- Name: idx_social_feed_activities_type_occurred; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_social_feed_activities_type_occurred ON public.social_feed_activities USING btree (activity_type, occurred_at);


--
-- Name: idx_social_feed_activities_user_occurred; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_social_feed_activities_user_occurred ON public.social_feed_activities USING btree (user_id, occurred_at);


--
-- Name: idx_tag_follows_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tag_follows_deleted_at ON public.tag_follows USING btree (deleted_at);


--
-- Name: idx_tag_follows_tag_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tag_follows_tag_id ON public.tag_follows USING btree (tag_id);


--
-- Name: idx_tag_follows_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tag_follows_user_id ON public.tag_follows USING btree (user_id);


--
-- Name: idx_tags_active_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tags_active_created_at ON public.tags USING btree (created_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_tournament_participants_leaderboard; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tournament_participants_leaderboard ON public.tournament_participants USING btree (tournament_id, total_score, total_time_ms);


--
-- Name: idx_tournament_participants_tournament_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tournament_participants_tournament_id ON public.tournament_participants USING btree (tournament_id);


--
-- Name: idx_tournament_participants_user_completed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tournament_participants_user_completed ON public.tournament_participants USING btree (user_id, participant_id) WHERE (rank_final IS NOT NULL);


--
-- Name: idx_tournament_participants_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tournament_participants_user_id ON public.tournament_participants USING btree (user_id);


--
-- Name: idx_tournament_participants_user_rank_final; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tournament_participants_user_rank_final ON public.tournament_participants USING btree (user_id, rank_final) WHERE (rank_final IS NOT NULL);


--
-- Name: idx_tournament_participants_user_registered; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tournament_participants_user_registered ON public.tournament_participants USING btree (user_id, registered_at, participant_id);


--
-- Name: idx_tournament_round_participants_attempt_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tournament_round_participants_attempt_id ON public.tournament_round_participants USING btree (attempt_id);


--
-- Name: idx_tournament_round_participants_participant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tournament_round_participants_participant_id ON public.tournament_round_participants USING btree (participant_id);


--
-- Name: idx_tournament_round_participants_round_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tournament_round_participants_round_id ON public.tournament_round_participants USING btree (round_id);


--
-- Name: idx_tournament_round_participants_round_leaderboard; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tournament_round_participants_round_leaderboard ON public.tournament_round_participants USING btree (round_id, round_score, round_time_ms);


--
-- Name: idx_tournament_rounds_quiz_version_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tournament_rounds_quiz_version_id ON public.tournament_rounds USING btree (quiz_version_id);


--
-- Name: idx_tournament_rounds_tournament_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tournament_rounds_tournament_status ON public.tournament_rounds USING btree (tournament_id, status);


--
-- Name: idx_tournaments_category_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tournaments_category_active ON public.tournaments USING btree (category_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_tournaments_owner_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tournaments_owner_active ON public.tournaments USING btree (owner_user_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_tournaments_status_start_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tournaments_status_start_at ON public.tournaments USING btree (status, start_at);


--
-- Name: idx_user_activity_events_cursor_pagination; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_activity_events_cursor_pagination ON public.user_activity_events USING btree (user_id, created_at, event_id);


--
-- Name: idx_user_activity_events_user_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_activity_events_user_created ON public.user_activity_events USING btree (user_id, created_at);


--
-- Name: idx_user_activity_events_user_occurred; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_activity_events_user_occurred ON public.user_activity_events USING btree (user_id, occurred_at);


--
-- Name: idx_user_activity_events_user_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_activity_events_user_type ON public.user_activity_events USING btree (user_id, "eventType");


--
-- Name: idx_user_activity_events_visibility; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_activity_events_visibility ON public.user_activity_events USING btree (visibility, occurred_at);


--
-- Name: idx_user_badges_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_badges_active ON public.user_badges USING btree (revoked_at);


--
-- Name: idx_user_badges_badge_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_badges_badge_id ON public.user_badges USING btree (badge_id);


--
-- Name: idx_user_badges_cursor_pagination; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_badges_cursor_pagination ON public.user_badges USING btree (user_id, revoked_at, earned_at, user_badge_id);


--
-- Name: idx_user_badges_earned_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_badges_earned_at ON public.user_badges USING btree (earned_at);


--
-- Name: idx_user_badges_user_active_earned; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_badges_user_active_earned ON public.user_badges USING btree (user_id, revoked_at, earned_at);


--
-- Name: idx_user_badges_user_badge; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_badges_user_badge ON public.user_badges USING btree (user_id, badge_id);


--
-- Name: idx_user_badges_user_badge_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_badges_user_badge_active ON public.user_badges USING btree (user_id, badge_id, revoked_at);


--
-- Name: idx_user_badges_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_badges_user_id ON public.user_badges USING btree (user_id);


--
-- Name: idx_user_follows_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_follows_deleted_at ON public.user_follows USING btree (deleted_at);


--
-- Name: idx_user_follows_follower; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_follows_follower ON public.user_follows USING btree (follower_id);


--
-- Name: idx_user_follows_following; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_follows_following ON public.user_follows USING btree (following_id);


--
-- Name: idx_user_profile_settings_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_profile_settings_user_id ON public.user_profile_settings USING btree (user_id);


--
-- Name: idx_user_profiles_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_profiles_user_id ON public.user_profiles USING btree (user_id);


--
-- Name: idx_user_ranking_all_time_rank; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_ranking_all_time_rank ON public.user_ranking USING btree (all_time_rank);


--
-- Name: idx_user_ranking_daily_rank; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_ranking_daily_rank ON public.user_ranking USING btree (daily_rank);


--
-- Name: idx_user_ranking_dirty; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_ranking_dirty ON public.user_ranking USING btree (is_dirty);


--
-- Name: idx_user_ranking_monthly_rank; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_ranking_monthly_rank ON public.user_ranking USING btree (monthly_rank);


--
-- Name: idx_user_ranking_user_dirty_updated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_ranking_user_dirty_updated ON public.user_ranking USING btree (user_id, is_dirty, updated_at);


--
-- Name: idx_user_ranking_weekly_rank; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_ranking_weekly_rank ON public.user_ranking USING btree (weekly_rank);


--
-- Name: idx_user_sessions_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_sessions_active ON public.user_sessions USING btree (user_id) WHERE (revoked_at IS NULL);


--
-- Name: idx_user_sessions_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_sessions_expires_at ON public.user_sessions USING btree (expires_at);


--
-- Name: idx_user_sessions_jti_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_sessions_jti_user ON public.user_sessions USING btree (jti, user_id);


--
-- Name: idx_user_sessions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_sessions_user_id ON public.user_sessions USING btree (user_id);


--
-- Name: idx_user_sessions_user_last_used_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_sessions_user_last_used_at ON public.user_sessions USING btree (user_id, last_used_at);


--
-- Name: idx_users_active_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_active_created_at ON public.users USING btree (created_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_users_email_verification_token_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_email_verification_token_active ON public.users USING btree (email_verification_token_hash) WHERE ((deleted_at IS NULL) AND (is_verified = false));


--
-- Name: idx_users_search_vector; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_search_vector ON public.users USING gin (user_search_vector) WHERE (deleted_at IS NULL);


--
-- Name: uq_blocked_users_pair; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_blocked_users_pair ON public.blocked_users USING btree (blocker_id, blocked_id) WHERE (deleted_at IS NULL);


--
-- Name: uq_categories_name_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_categories_name_active ON public.categories USING btree (lower(name)) WHERE (deleted_at IS NULL);


--
-- Name: uq_categories_slug_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_categories_slug_active ON public.categories USING btree (slug) WHERE (deleted_at IS NULL);


--
-- Name: uq_category_follows_user_category_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_category_follows_user_category_active ON public.category_follows USING btree (user_id, category_id) WHERE (deleted_at IS NULL);


--
-- Name: uq_comment_reports_reporter_comment; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_comment_reports_reporter_comment ON public.comment_reports USING btree (reporter_id, comment_id);


--
-- Name: uq_comment_votes_user_comment; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_comment_votes_user_comment ON public.comment_votes USING btree (user_id, comment_id);


--
-- Name: uq_friendships_pair; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_friendships_pair ON public.friendships USING btree (requester_id, addressee_id) WHERE (deleted_at IS NULL);


--
-- Name: uq_oauth_accounts_provider_provider_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_oauth_accounts_provider_provider_user_id ON public.oauth_accounts USING btree (provider, provider_user_id);


--
-- Name: uq_oauth_accounts_user_id_provider; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_oauth_accounts_user_id_provider ON public.oauth_accounts USING btree (user_id, provider);


--
-- Name: uq_outbox_events_idempotency_unprocessed; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_outbox_events_idempotency_unprocessed ON public.outbox_events USING btree (idempotency_key) WHERE ((processed_at IS NULL) AND (idempotency_key IS NOT NULL));


--
-- Name: uq_quiz_answer_options_one_correct; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_quiz_answer_options_one_correct ON public.quiz_answer_options USING btree (question_id) WHERE (is_correct = true);


--
-- Name: uq_quizzes_slug_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_quizzes_slug_active ON public.quizzes USING btree (slug) WHERE (deleted_at IS NULL);


--
-- Name: uq_rank_history_user_period_snapshot; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_rank_history_user_period_snapshot ON public.rank_history USING btree (user_id, period, snapshot_date);


--
-- Name: uq_rank_recalculation_work_items_user_period; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_rank_recalculation_work_items_user_period ON public.rank_recalculation_work_items USING btree (user_id, period);


--
-- Name: uq_ranking_milestones_user_milestone; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_ranking_milestones_user_milestone ON public.ranking_milestones USING btree (user_id, milestone);


--
-- Name: uq_review_helpful_votes_review_user; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_review_helpful_votes_review_user ON public.review_helpful_votes USING btree (review_id, user_id);


--
-- Name: uq_review_reports_review_reporter; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_review_reports_review_reporter ON public.review_reports USING btree (review_id, reporter_id);


--
-- Name: uq_sent_verification_tokens_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_sent_verification_tokens_hash ON public.sent_verification_tokens USING btree (token_hash);


--
-- Name: uq_tag_follows_user_tag_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_tag_follows_user_tag_active ON public.tag_follows USING btree (user_id, tag_id) WHERE (deleted_at IS NULL);


--
-- Name: uq_tags_name_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_tags_name_active ON public.tags USING btree (lower(name)) WHERE (deleted_at IS NULL);


--
-- Name: uq_tags_slug_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_tags_slug_active ON public.tags USING btree (slug) WHERE (deleted_at IS NULL);


--
-- Name: uq_user_badges_user_badge_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_user_badges_user_badge_active ON public.user_badges USING btree (user_id, badge_id) WHERE (revoked_at IS NULL);


--
-- Name: uq_user_follows_pair; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_user_follows_pair ON public.user_follows USING btree (follower_id, following_id) WHERE (deleted_at IS NULL);


--
-- Name: uq_users_email_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_users_email_active ON public.users USING btree (email) WHERE (deleted_at IS NULL);


--
-- Name: uq_users_username_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_users_username_active ON public.users USING btree (username) WHERE (deleted_at IS NULL);


--
-- Name: auth_audit_logs auth_audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_audit_logs
    ADD CONSTRAINT auth_audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE SET NULL;


--
-- Name: badge_rules badge_rules_badge_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.badge_rules
    ADD CONSTRAINT badge_rules_badge_id_fkey FOREIGN KEY (badge_id) REFERENCES public.badges(badge_id) ON DELETE CASCADE;


--
-- Name: blocked_users blocked_users_blocked_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blocked_users
    ADD CONSTRAINT blocked_users_blocked_id_fkey FOREIGN KEY (blocked_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: blocked_users blocked_users_blocker_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blocked_users
    ADD CONSTRAINT blocked_users_blocker_id_fkey FOREIGN KEY (blocker_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: bookmark_collections bookmark_collections_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookmark_collections
    ADD CONSTRAINT bookmark_collections_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: bookmarked_quizzes bookmarked_quizzes_collection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookmarked_quizzes
    ADD CONSTRAINT bookmarked_quizzes_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES public.bookmark_collections(collection_id) ON DELETE CASCADE;


--
-- Name: bookmarked_quizzes bookmarked_quizzes_quiz_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookmarked_quizzes
    ADD CONSTRAINT bookmarked_quizzes_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES public.quizzes(quiz_id) ON DELETE CASCADE;


--
-- Name: category_follows category_follows_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category_follows
    ADD CONSTRAINT category_follows_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(category_id) ON DELETE CASCADE;


--
-- Name: category_follows category_follows_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category_follows
    ADD CONSTRAINT category_follows_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: comments comments_parent_comment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_parent_comment_id_fkey FOREIGN KEY (parent_comment_id) REFERENCES public.comments(comment_id) ON DELETE CASCADE;


--
-- Name: friendships friendships_addressee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.friendships
    ADD CONSTRAINT friendships_addressee_id_fkey FOREIGN KEY (addressee_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: friendships friendships_requester_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.friendships
    ADD CONSTRAINT friendships_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: notification_preferences notification_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: oauth_accounts oauth_accounts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oauth_accounts
    ADD CONSTRAINT oauth_accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: password_history password_history_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_history
    ADD CONSTRAINT password_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: password_history password_history_user_id_users_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_history
    ADD CONSTRAINT password_history_user_id_users_user_id_fk FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: password_reset_tokens password_reset_tokens_user_id_users_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_user_id_users_user_id_fk FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: quiz_answer_options quiz_answer_options_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_answer_options
    ADD CONSTRAINT quiz_answer_options_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.quiz_questions(question_id) ON DELETE CASCADE;


--
-- Name: quiz_attempt_answers quiz_attempt_answers_attempt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_attempt_answers
    ADD CONSTRAINT quiz_attempt_answers_attempt_id_fkey FOREIGN KEY (attempt_id) REFERENCES public.quiz_attempts(attempt_id) ON DELETE CASCADE;


--
-- Name: quiz_attempt_answers quiz_attempt_answers_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_attempt_answers
    ADD CONSTRAINT quiz_attempt_answers_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.quiz_questions(question_id) ON DELETE RESTRICT;


--
-- Name: quiz_attempt_answers quiz_attempt_answers_selected_option_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_attempt_answers
    ADD CONSTRAINT quiz_attempt_answers_selected_option_id_fkey FOREIGN KEY (selected_option_id) REFERENCES public.quiz_answer_options(option_id) ON DELETE RESTRICT;


--
-- Name: quiz_attempt_events quiz_attempt_events_attempt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_attempt_events
    ADD CONSTRAINT quiz_attempt_events_attempt_id_fkey FOREIGN KEY (attempt_id) REFERENCES public.quiz_attempts(attempt_id) ON DELETE CASCADE;


--
-- Name: quiz_attempt_events quiz_attempt_events_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_attempt_events
    ADD CONSTRAINT quiz_attempt_events_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.quiz_questions(question_id) ON DELETE SET NULL;


--
-- Name: quiz_attempt_events quiz_attempt_events_selected_option_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_attempt_events
    ADD CONSTRAINT quiz_attempt_events_selected_option_id_fkey FOREIGN KEY (selected_option_id) REFERENCES public.quiz_answer_options(option_id) ON DELETE SET NULL;


--
-- Name: quiz_attempts quiz_attempts_quiz_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_attempts
    ADD CONSTRAINT quiz_attempts_quiz_version_id_fkey FOREIGN KEY (quiz_version_id) REFERENCES public.quiz_versions(quiz_version_id) ON DELETE RESTRICT;


--
-- Name: quiz_attempts quiz_attempts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_attempts
    ADD CONSTRAINT quiz_attempts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE RESTRICT;


--
-- Name: quiz_instance_players quiz_instance_players_attempt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_instance_players
    ADD CONSTRAINT quiz_instance_players_attempt_id_fkey FOREIGN KEY (attempt_id) REFERENCES public.quiz_attempts(attempt_id) ON DELETE SET NULL;


--
-- Name: quiz_instance_players quiz_instance_players_instance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_instance_players
    ADD CONSTRAINT quiz_instance_players_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES public.quiz_instances(instance_id) ON DELETE CASCADE;


--
-- Name: quiz_instance_players quiz_instance_players_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_instance_players
    ADD CONSTRAINT quiz_instance_players_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE RESTRICT;


--
-- Name: quiz_instances quiz_instances_host_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_instances
    ADD CONSTRAINT quiz_instances_host_user_id_fkey FOREIGN KEY (host_user_id) REFERENCES public.users(user_id) ON DELETE RESTRICT;


--
-- Name: quiz_instances quiz_instances_quiz_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_instances
    ADD CONSTRAINT quiz_instances_quiz_version_id_fkey FOREIGN KEY (quiz_version_id) REFERENCES public.quiz_versions(quiz_version_id) ON DELETE RESTRICT;


--
-- Name: quiz_questions quiz_questions_quiz_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_questions
    ADD CONSTRAINT quiz_questions_quiz_version_id_fkey FOREIGN KEY (quiz_version_id) REFERENCES public.quiz_versions(quiz_version_id) ON DELETE CASCADE;


--
-- Name: quiz_reviews quiz_reviews_quiz_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_reviews
    ADD CONSTRAINT quiz_reviews_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES public.quizzes(quiz_id) ON DELETE CASCADE;


--
-- Name: quiz_reviews quiz_reviews_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_reviews
    ADD CONSTRAINT quiz_reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE RESTRICT;


--
-- Name: quiz_stats quiz_stats_quiz_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_stats
    ADD CONSTRAINT quiz_stats_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES public.quizzes(quiz_id) ON DELETE CASCADE;


--
-- Name: quiz_tags quiz_tags_quiz_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_tags
    ADD CONSTRAINT quiz_tags_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES public.quizzes(quiz_id) ON DELETE CASCADE;


--
-- Name: quiz_tags quiz_tags_tag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_tags
    ADD CONSTRAINT quiz_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.tags(tag_id) ON DELETE CASCADE;


--
-- Name: quiz_versions quiz_versions_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_versions
    ADD CONSTRAINT quiz_versions_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(user_id) ON DELETE SET NULL;


--
-- Name: quiz_versions quiz_versions_quiz_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_versions
    ADD CONSTRAINT quiz_versions_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES public.quizzes(quiz_id) ON DELETE CASCADE;


--
-- Name: quizzes quizzes_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quizzes
    ADD CONSTRAINT quizzes_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(category_id) ON DELETE SET NULL;


--
-- Name: quizzes quizzes_creator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quizzes
    ADD CONSTRAINT quizzes_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.users(user_id) ON DELETE SET NULL;


--
-- Name: quizzes quizzes_published_version_id_quiz_versions_quiz_version_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quizzes
    ADD CONSTRAINT quizzes_published_version_id_quiz_versions_quiz_version_id_fk FOREIGN KEY (published_version_id) REFERENCES public.quiz_versions(quiz_version_id) ON DELETE SET NULL;


--
-- Name: rank_history rank_history_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rank_history
    ADD CONSTRAINT rank_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: rank_recalculation_work_items rank_recalculation_work_items_user_id_users_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rank_recalculation_work_items
    ADD CONSTRAINT rank_recalculation_work_items_user_id_users_user_id_fk FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: ranking_milestones ranking_milestones_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ranking_milestones
    ADD CONSTRAINT ranking_milestones_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: review_helpful_votes review_helpful_votes_review_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_helpful_votes
    ADD CONSTRAINT review_helpful_votes_review_id_fkey FOREIGN KEY (review_id) REFERENCES public.quiz_reviews(review_id) ON DELETE CASCADE;


--
-- Name: review_helpful_votes review_helpful_votes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_helpful_votes
    ADD CONSTRAINT review_helpful_votes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: review_reports review_reports_reporter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_reports
    ADD CONSTRAINT review_reports_reporter_id_fkey FOREIGN KEY (reporter_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: review_reports review_reports_review_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_reports
    ADD CONSTRAINT review_reports_review_id_fkey FOREIGN KEY (review_id) REFERENCES public.quiz_reviews(review_id) ON DELETE CASCADE;


--
-- Name: sent_verification_tokens sent_verification_tokens_user_id_users_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sent_verification_tokens
    ADD CONSTRAINT sent_verification_tokens_user_id_users_user_id_fk FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE SET NULL;


--
-- Name: social_feed_activities social_feed_activities_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_feed_activities
    ADD CONSTRAINT social_feed_activities_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: tag_follows tag_follows_tag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tag_follows
    ADD CONSTRAINT tag_follows_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.tags(tag_id) ON DELETE CASCADE;


--
-- Name: tag_follows tag_follows_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tag_follows
    ADD CONSTRAINT tag_follows_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: tournament_participants tournament_participants_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_participants
    ADD CONSTRAINT tournament_participants_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(tournament_id) ON DELETE CASCADE;


--
-- Name: tournament_participants tournament_participants_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_participants
    ADD CONSTRAINT tournament_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE RESTRICT;


--
-- Name: tournament_round_participants tournament_round_participants_attempt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_round_participants
    ADD CONSTRAINT tournament_round_participants_attempt_id_fkey FOREIGN KEY (attempt_id) REFERENCES public.quiz_attempts(attempt_id) ON DELETE SET NULL;


--
-- Name: tournament_round_participants tournament_round_participants_participant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_round_participants
    ADD CONSTRAINT tournament_round_participants_participant_id_fkey FOREIGN KEY (participant_id) REFERENCES public.tournament_participants(participant_id) ON DELETE CASCADE;


--
-- Name: tournament_round_participants tournament_round_participants_round_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_round_participants
    ADD CONSTRAINT tournament_round_participants_round_id_fkey FOREIGN KEY (round_id) REFERENCES public.tournament_rounds(round_id) ON DELETE CASCADE;


--
-- Name: tournament_rounds tournament_rounds_quiz_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_rounds
    ADD CONSTRAINT tournament_rounds_quiz_version_id_fkey FOREIGN KEY (quiz_version_id) REFERENCES public.quiz_versions(quiz_version_id) ON DELETE RESTRICT;


--
-- Name: tournament_rounds tournament_rounds_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_rounds
    ADD CONSTRAINT tournament_rounds_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(tournament_id) ON DELETE CASCADE;


--
-- Name: tournament_stats tournament_stats_tournament_id_tournaments_tournament_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_stats
    ADD CONSTRAINT tournament_stats_tournament_id_tournaments_tournament_id_fk FOREIGN KEY (tournament_id) REFERENCES public.tournaments(tournament_id) ON DELETE CASCADE;


--
-- Name: tournaments tournaments_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournaments
    ADD CONSTRAINT tournaments_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(category_id) ON DELETE SET NULL;


--
-- Name: tournaments tournaments_owner_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournaments
    ADD CONSTRAINT tournaments_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES public.users(user_id) ON DELETE RESTRICT;


--
-- Name: user_activity_events user_activity_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_activity_events
    ADD CONSTRAINT user_activity_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: user_badges user_badges_badge_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_badges
    ADD CONSTRAINT user_badges_badge_id_fkey FOREIGN KEY (badge_id) REFERENCES public.badges(badge_id) ON DELETE RESTRICT;


--
-- Name: user_badges user_badges_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_badges
    ADD CONSTRAINT user_badges_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: user_follows user_follows_follower_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_follows
    ADD CONSTRAINT user_follows_follower_id_fkey FOREIGN KEY (follower_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: user_follows user_follows_following_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_follows
    ADD CONSTRAINT user_follows_following_id_fkey FOREIGN KEY (following_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: user_profile_settings user_profile_settings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profile_settings
    ADD CONSTRAINT user_profile_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: user_profiles user_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: user_ranking user_ranking_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_ranking
    ADD CONSTRAINT user_ranking_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: user_sessions user_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict PNRfrzzvRfVUymIBRlbmnRMEbeYPFfSsBJqdMtWITLssljQcQ9hoLzEfe3GE6pV

