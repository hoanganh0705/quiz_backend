CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TYPE quiz_difficulty AS ENUM ('easy', 'medium', 'hard');
CREATE TYPE quiz_attempt_status AS ENUM ('started', 'completed', 'abandoned');
CREATE TYPE quiz_instance_status AS ENUM ('open', 'running', 'closed', 'finished');
CREATE TYPE quiz_instance_player_status AS ENUM (
  'joined',
  'ready',
  'playing',
  'disconnected',
  'finished'
);
CREATE TYPE tournament_status AS ENUM (
  'upcoming',
  'registration',
  'ongoing',
  'finished',
  'cancelled'
);
CREATE TYPE tournament_round_status AS ENUM (
  'pending',
  'open',
  'running',
  'finished'
);
CREATE TYPE tournament_participant_status AS ENUM ('active', 'eliminated', 'winner');
CREATE TYPE badge_type AS ENUM ('diamond', 'platinum', 'gold', 'silver', 'bronze');
CREATE TYPE badge_condition_type AS ENUM (
  'quizzes_completed',
  'quizzes_passed',
  'streak_days',
  'xp_earned',
  'tournaments_won',
  'perfect_score'
);
CREATE TYPE quiz_version_status AS ENUM ('draft', 'published', 'archived');
CREATE TYPE quiz_event_type AS ENUM (
  'question_viewed',
  'answer_selected',
  'attempt_started',
  'attempt_submitted'
);

CREATE TABLE categories (
  category_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  slug text NOT NULL,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT categories_name_nonblank CHECK (length(btrim(name)) > 0),
  CONSTRAINT categories_slug_format CHECK (
    slug = lower(slug) AND slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  )
);

CREATE UNIQUE INDEX uq_categories_slug_active ON categories (slug)
WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX uq_categories_name_active ON categories ((lower(name)))
WHERE deleted_at IS NULL;

CREATE INDEX idx_categories_active_created_at ON categories (created_at)
WHERE deleted_at IS NULL;


CREATE TABLE tags (
  tag_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT tags_name_nonblank CHECK (length(btrim(name)) > 0),
  CONSTRAINT tags_slug_format CHECK (
    slug = lower(slug) AND slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  )
);

CREATE UNIQUE INDEX uq_tags_slug_active ON tags (slug)
WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX uq_tags_name_active ON tags ((lower(name)))
WHERE deleted_at IS NULL;

CREATE INDEX idx_tags_active_created_at ON tags (created_at)
WHERE deleted_at IS NULL;


CREATE TABLE badges (
  badge_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  type badge_type NOT NULL,
  name text NOT NULL,
  description text,
  condition_type badge_condition_type NOT NULL,
  condition_value int NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT badges_slug_format CHECK (
    slug = lower(slug) AND slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  CONSTRAINT badges_name_nonblank CHECK (length(btrim(name)) > 0),
  CONSTRAINT badges_condition_value_positive CHECK (condition_value > 0),
  CONSTRAINT uq_badges_slug UNIQUE (slug)
);

CREATE INDEX idx_badges_condition_type ON badges (condition_type);


CREATE TABLE users (
  user_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username citext NOT NULL,
  email citext NOT NULL,
  display_name text,
  avatar_url text,
  bio text,
  xp_total int NOT NULL DEFAULT 0,
  current_streak int NOT NULL DEFAULT 0,
  longest_streak int NOT NULL DEFAULT 0,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT users_username_len CHECK (length(username) BETWEEN 3 AND 50),
  CONSTRAINT users_email_len CHECK (length(email) BETWEEN 3 AND 255),
  CONSTRAINT users_email_like CHECK (position('@' in email) > 1),
  CONSTRAINT users_xp_nonneg CHECK (xp_total >= 0),
  CONSTRAINT users_streak_nonneg CHECK (current_streak >= 0 AND longest_streak >= 0),
  CONSTRAINT users_streak_order CHECK (longest_streak >= current_streak),
  CONSTRAINT users_settings_object CHECK (jsonb_typeof(settings) = 'object'),
  CONSTRAINT uq_users_username UNIQUE (username),
  CONSTRAINT uq_users_email UNIQUE (email)
);

CREATE INDEX idx_users_active_created_at ON users (created_at)
WHERE deleted_at IS NULL;


CREATE TABLE user_badges (
  user_id uuid NOT NULL REFERENCES users (user_id) ON DELETE CASCADE,
  badge_id uuid NOT NULL REFERENCES badges (badge_id) ON DELETE RESTRICT,
  earned_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (user_id, badge_id),
  CONSTRAINT user_badges_metadata_object CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX idx_user_badges_badge_id ON user_badges (badge_id);


CREATE TABLE quizzes (
  quiz_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid REFERENCES users (user_id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  slug text NOT NULL,
  difficulty quiz_difficulty NOT NULL,
  duration_ms int NOT NULL,
  passing_score_percent smallint NOT NULL DEFAULT 50,
  reward_xp int NOT NULL DEFAULT 0,
  requirements text,
  image_url text,
  is_featured boolean NOT NULL DEFAULT false,
  is_hidden boolean NOT NULL DEFAULT false,
  is_verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT quizzes_title_nonblank CHECK (length(btrim(title)) > 0),
  CONSTRAINT quizzes_slug_format CHECK (
    slug = lower(slug) AND slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  CONSTRAINT quizzes_duration_ms_positive CHECK (duration_ms > 0),
  CONSTRAINT quizzes_passing_score_percent_range CHECK (passing_score_percent BETWEEN 0 AND 100),
  CONSTRAINT quizzes_reward_xp_nonneg CHECK (reward_xp >= 0)
);

CREATE UNIQUE INDEX uq_quizzes_slug_active ON quizzes (slug)
WHERE deleted_at IS NULL;

CREATE INDEX idx_quizzes_creator_active ON quizzes (creator_id)
WHERE deleted_at IS NULL;

CREATE INDEX idx_quizzes_active_created_at ON quizzes (created_at)
WHERE deleted_at IS NULL;


CREATE TABLE quiz_versions (
  quiz_version_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES quizzes (quiz_id) ON DELETE RESTRICT,
  version_number int NOT NULL,
  status quiz_version_status NOT NULL DEFAULT 'draft',
  difficulty quiz_difficulty NOT NULL,
  duration_ms int NOT NULL,
  passing_score_percent smallint NOT NULL,
  reward_xp int NOT NULL,
  created_by_user_id uuid REFERENCES users (user_id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  archived_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quiz_versions_version_number_positive CHECK (version_number > 0),
  CONSTRAINT quiz_versions_duration_ms_positive CHECK (duration_ms > 0),
  CONSTRAINT quiz_versions_passing_score_percent_range CHECK (passing_score_percent BETWEEN 0 AND 100),
  CONSTRAINT quiz_versions_reward_xp_nonneg CHECK (reward_xp >= 0),
  CONSTRAINT uq_quiz_versions_quiz_version UNIQUE (quiz_id, version_number)
);

CREATE INDEX idx_quiz_versions_quiz_id ON quiz_versions (quiz_id);


CREATE TABLE quiz_questions (
  question_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_version_id uuid NOT NULL REFERENCES quiz_versions (quiz_version_id) ON DELETE RESTRICT,
  position int NOT NULL,
  question_text text NOT NULL,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quiz_questions_position_positive CHECK (position > 0),
  CONSTRAINT quiz_questions_text_nonblank CHECK (length(btrim(question_text)) > 0),
  CONSTRAINT uq_quiz_questions_version_position UNIQUE (quiz_version_id, position),
  CONSTRAINT uq_quiz_questions_version_question UNIQUE (quiz_version_id, question_id)
);

CREATE INDEX idx_quiz_questions_quiz_version_id ON quiz_questions (quiz_version_id);


CREATE TABLE quiz_answer_options (
  option_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES quiz_questions (question_id) ON DELETE CASCADE,
  position int NOT NULL,
  value text NOT NULL,
  is_correct boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quiz_answer_options_position_positive CHECK (position > 0),
  CONSTRAINT quiz_answer_options_value_nonblank CHECK (length(btrim(value)) > 0),
  CONSTRAINT uq_quiz_answer_options_question_position UNIQUE (question_id, position),
  CONSTRAINT uq_quiz_answer_options_question_option UNIQUE (question_id, option_id)
);

CREATE INDEX idx_quiz_answer_options_question_id ON quiz_answer_options (question_id);

CREATE UNIQUE INDEX uq_quiz_answer_options_one_correct
ON quiz_answer_options (question_id)
WHERE is_correct = true;


CREATE TABLE quiz_categories (
  quiz_id uuid NOT NULL REFERENCES quizzes (quiz_id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES categories (category_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (quiz_id, category_id)
);

CREATE INDEX idx_quiz_categories_category_id ON quiz_categories (category_id);


CREATE TABLE quiz_tags (
  quiz_id uuid NOT NULL REFERENCES quizzes (quiz_id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES tags (tag_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (quiz_id, tag_id)
);

CREATE INDEX idx_quiz_tags_tag_id ON quiz_tags (tag_id);


CREATE TABLE quiz_stats (
  quiz_id uuid PRIMARY KEY REFERENCES quizzes (quiz_id) ON DELETE CASCADE,
  total_attempts bigint NOT NULL DEFAULT 0,
  total_players bigint NOT NULL DEFAULT 0,
  avg_score_percent numeric(5, 2) NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quiz_stats_total_attempts_nonneg CHECK (total_attempts >= 0),
  CONSTRAINT quiz_stats_total_players_nonneg CHECK (total_players >= 0),
  CONSTRAINT quiz_stats_avg_score_percent_range CHECK (avg_score_percent BETWEEN 0 AND 100)
);

CREATE INDEX idx_quiz_stats_total_attempts_desc
ON quiz_stats (total_attempts DESC, quiz_id);

CREATE INDEX idx_quiz_stats_avg_score_percent_desc
ON quiz_stats (avg_score_percent DESC, quiz_id);

CREATE INDEX idx_quiz_stats_last_attempt_at_desc
ON quiz_stats (last_attempt_at DESC);


CREATE TABLE quiz_attempts (
  attempt_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (user_id) ON DELETE RESTRICT,
  quiz_version_id uuid NOT NULL REFERENCES quiz_versions (quiz_version_id) ON DELETE RESTRICT,
  status quiz_attempt_status NOT NULL DEFAULT 'started',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  time_taken_ms int,
  duration_ms int NOT NULL,
  passing_score_percent smallint NOT NULL,
  reward_xp int NOT NULL,
  question_count int NOT NULL,
  correct_count int NOT NULL DEFAULT 0,
  score_percent smallint NOT NULL DEFAULT 0,
  xp_earned int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quiz_attempts_duration_ms_positive CHECK (duration_ms > 0),
  CONSTRAINT quiz_attempts_passing_score_percent_range CHECK (passing_score_percent BETWEEN 0 AND 100),
  CONSTRAINT quiz_attempts_reward_xp_nonneg CHECK (reward_xp >= 0),
  CONSTRAINT quiz_attempts_question_count_positive CHECK (question_count > 0),
  CONSTRAINT quiz_attempts_correct_count_range CHECK (correct_count BETWEEN 0 AND question_count),
  CONSTRAINT quiz_attempts_score_percent_range CHECK (score_percent BETWEEN 0 AND 100),
  CONSTRAINT quiz_attempts_xp_earned_nonneg CHECK (xp_earned >= 0),
  CONSTRAINT quiz_attempts_time_taken_ms_nonneg CHECK (time_taken_ms IS NULL OR time_taken_ms >= 0),
  CONSTRAINT quiz_attempts_status_finished_at_consistency CHECK (
    (status = 'started' AND finished_at IS NULL)
    OR (status IN ('completed', 'abandoned') AND finished_at IS NOT NULL)
  ),
  CONSTRAINT uq_quiz_attempts_attempt_version UNIQUE (attempt_id, quiz_version_id),
  CONSTRAINT uq_quiz_attempts_attempt_user UNIQUE (attempt_id, user_id)
);

CREATE INDEX idx_quiz_attempts_user_started_at_desc
ON quiz_attempts (user_id, started_at DESC);

CREATE INDEX idx_quiz_attempts_leaderboard
ON quiz_attempts (quiz_version_id, score_percent DESC, time_taken_ms ASC, finished_at DESC)
WHERE status = 'completed';

CREATE INDEX idx_quiz_attempts_version_user
ON quiz_attempts (quiz_version_id, user_id, score_percent DESC)
WHERE status = 'completed';


CREATE TABLE quiz_attempt_answers (
  attempt_id uuid NOT NULL,
  quiz_version_id uuid NOT NULL,
  question_id uuid NOT NULL,
  selected_option_id uuid NOT NULL,
  answered_at timestamptz NOT NULL DEFAULT now(),
  time_taken_ms int,
  PRIMARY KEY (attempt_id, question_id),
  CONSTRAINT quiz_attempt_answers_time_taken_ms_nonneg CHECK (time_taken_ms IS NULL OR time_taken_ms >= 0),
  CONSTRAINT fk_quiz_attempt_answers_attempt
    FOREIGN KEY (attempt_id, quiz_version_id)
    REFERENCES quiz_attempts (attempt_id, quiz_version_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_quiz_attempt_answers_question
    FOREIGN KEY (quiz_version_id, question_id)
    REFERENCES quiz_questions (quiz_version_id, question_id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_quiz_attempt_answers_selected_option
    FOREIGN KEY (question_id, selected_option_id)
    REFERENCES quiz_answer_options (question_id, option_id)
    ON DELETE RESTRICT
);

CREATE INDEX idx_quiz_attempt_answers_question_id ON quiz_attempt_answers (question_id);


CREATE TABLE quiz_attempt_events (
  event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES quiz_attempts (attempt_id) ON DELETE CASCADE,
  event_type text NOT NULL,
  question_id uuid REFERENCES quiz_questions (question_id) ON DELETE RESTRICT,
  selected_option_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quiz_attempt_events_option_requires_question CHECK (
    selected_option_id IS NULL OR question_id IS NOT NULL
  ),
  CONSTRAINT fk_quiz_attempt_events_selected_option
    FOREIGN KEY (question_id, selected_option_id)
    REFERENCES quiz_answer_options (question_id, option_id)
    ON DELETE RESTRICT
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM quiz_attempt_events
    WHERE event_type IS NULL
  ) THEN
    RAISE EXCEPTION 'quiz_attempt_events.event_type contains NULL values';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM quiz_attempt_events
    WHERE event_type NOT IN (
      'question_viewed',
      'answer_selected',
      'attempt_started',
      'attempt_submitted'
    )
  ) THEN
    RAISE EXCEPTION 'quiz_attempt_events.event_type contains invalid values: %',
      (
        SELECT array_agg(DISTINCT event_type ORDER BY event_type)
        FROM quiz_attempt_events
        WHERE event_type NOT IN (
          'question_viewed',
          'answer_selected',
          'attempt_started',
          'attempt_submitted'
        )
      );
  END IF;
END $$;

ALTER TABLE quiz_attempt_events
ALTER COLUMN event_type TYPE quiz_event_type
USING event_type::quiz_event_type;

ALTER TABLE quiz_attempt_events
ALTER COLUMN event_type SET NOT NULL;

CREATE INDEX idx_quiz_attempt_events_attempt_id
ON quiz_attempt_events (attempt_id);

CREATE INDEX idx_quiz_attempt_events_attempt_created_at
ON quiz_attempt_events (attempt_id, created_at);


CREATE TABLE quiz_reviews (
  review_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES quizzes (quiz_id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users (user_id) ON DELETE RESTRICT,
  rating smallint NOT NULL,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quiz_reviews_rating_range CHECK (rating BETWEEN 1 AND 5),
  CONSTRAINT uq_quiz_reviews_quiz_user UNIQUE (quiz_id, user_id)
);

CREATE INDEX idx_quiz_reviews_quiz_created_at_desc
ON quiz_reviews (quiz_id, created_at DESC);

CREATE INDEX idx_quiz_reviews_user_created_at_desc
ON quiz_reviews (user_id, created_at DESC);


CREATE TABLE bookmark_collections (
  collection_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (user_id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bookmark_collections_name_nonblank CHECK (length(btrim(name)) > 0),
  CONSTRAINT uq_bookmark_collections_user_name UNIQUE (user_id, name)
);

CREATE INDEX idx_bookmark_collections_user_id ON bookmark_collections (user_id);


CREATE TABLE bookmarked_quizzes (
  collection_id uuid NOT NULL REFERENCES bookmark_collections (collection_id) ON DELETE CASCADE,
  quiz_id uuid NOT NULL REFERENCES quizzes (quiz_id) ON DELETE CASCADE,
  bookmarked_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (collection_id, quiz_id)
);

CREATE INDEX idx_bookmarked_quizzes_quiz_id ON bookmarked_quizzes (quiz_id);


CREATE TABLE quiz_instances (
  instance_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_version_id uuid NOT NULL REFERENCES quiz_versions (quiz_version_id) ON DELETE RESTRICT,
  host_user_id uuid NOT NULL REFERENCES users (user_id) ON DELETE RESTRICT,
  max_players int,
  status quiz_instance_status NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  closed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quiz_instances_max_players_positive CHECK (max_players IS NULL OR max_players > 0),
  CONSTRAINT quiz_instances_started_closed_order CHECK (
    (started_at IS NULL OR closed_at IS NULL) OR closed_at >= started_at
  ),
  CONSTRAINT uq_quiz_instances_instance_version UNIQUE (instance_id, quiz_version_id)
);

CREATE INDEX idx_quiz_instances_version_status
ON quiz_instances (quiz_version_id, status);

CREATE INDEX idx_quiz_instances_host_status
ON quiz_instances (host_user_id, status);


CREATE TABLE quiz_instance_players (
  instance_id uuid NOT NULL,
  quiz_version_id uuid NOT NULL,
  user_id uuid NOT NULL,
  attempt_id uuid NOT NULL,
  status quiz_instance_player_status NOT NULL DEFAULT 'joined',
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  PRIMARY KEY (instance_id, user_id),
  CONSTRAINT quiz_instance_players_left_at_order CHECK (left_at IS NULL OR left_at >= joined_at),
  CONSTRAINT fk_quiz_instance_players_instance
    FOREIGN KEY (instance_id, quiz_version_id)
    REFERENCES quiz_instances (instance_id, quiz_version_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_quiz_instance_players_user
    FOREIGN KEY (user_id)
    REFERENCES users (user_id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_quiz_instance_players_attempt_user
    FOREIGN KEY (attempt_id, user_id)
    REFERENCES quiz_attempts (attempt_id, user_id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_quiz_instance_players_attempt_version
    FOREIGN KEY (attempt_id, quiz_version_id)
    REFERENCES quiz_attempts (attempt_id, quiz_version_id)
    ON DELETE RESTRICT
);

CREATE INDEX idx_quiz_instance_players_instance_id
ON quiz_instance_players (instance_id);

CREATE INDEX idx_quiz_instance_players_user_id
ON quiz_instance_players (user_id);


CREATE TABLE tournaments (
  tournament_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  difficulty quiz_difficulty NOT NULL,
  status tournament_status NOT NULL DEFAULT 'upcoming',
  prize text,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  max_participants int,
  category_id uuid REFERENCES categories (category_id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT tournaments_title_nonblank CHECK (length(btrim(title)) > 0),
  CONSTRAINT tournaments_start_end_order CHECK (end_at > start_at),
  CONSTRAINT tournaments_max_participants_positive CHECK (max_participants IS NULL OR max_participants > 0)
);

CREATE INDEX idx_tournaments_status_start_at
ON tournaments (status, start_at);

CREATE INDEX idx_tournaments_category_active
ON tournaments (category_id)
WHERE deleted_at IS NULL;


CREATE TABLE tournament_rounds (
  round_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES tournaments (tournament_id) ON DELETE CASCADE,
  round_number smallint NOT NULL,
  name text NOT NULL,
  description text,
  quiz_version_id uuid NOT NULL REFERENCES quiz_versions (quiz_version_id) ON DELETE RESTRICT,
  start_at timestamptz,
  end_at timestamptz,
  duration_ms int,
  status tournament_round_status NOT NULL DEFAULT 'pending',
  is_elimination boolean NOT NULL DEFAULT false,
  participant_limit int,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tournament_rounds_round_number_positive CHECK (round_number > 0),
  CONSTRAINT tournament_rounds_name_nonblank CHECK (length(btrim(name)) > 0),
  CONSTRAINT tournament_rounds_duration_ms_positive CHECK (duration_ms IS NULL OR duration_ms > 0),
  CONSTRAINT tournament_rounds_start_end_order CHECK (
    (start_at IS NULL OR end_at IS NULL) OR end_at > start_at
  ),
  CONSTRAINT tournament_rounds_participant_limit_positive CHECK (participant_limit IS NULL OR participant_limit > 0),
  CONSTRAINT uq_tournament_rounds_tournament_round_number UNIQUE (tournament_id, round_number),
  CONSTRAINT uq_tournament_rounds_round_tournament UNIQUE (round_id, tournament_id),
  CONSTRAINT uq_tournament_rounds_round_quiz_version UNIQUE (round_id, quiz_version_id)
);

CREATE INDEX idx_tournament_rounds_tournament_status
ON tournament_rounds (tournament_id, status);


CREATE TABLE tournament_participants (
  tournament_id uuid NOT NULL REFERENCES tournaments (tournament_id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users (user_id) ON DELETE RESTRICT,
  registered_at timestamptz NOT NULL DEFAULT now(),
  total_score int NOT NULL DEFAULT 0,
  total_time_ms int NOT NULL DEFAULT 0,
  rank_final smallint,
  status tournament_participant_status NOT NULL DEFAULT 'active',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tournament_id, user_id),
  CONSTRAINT tournament_participants_total_score_nonneg CHECK (total_score >= 0),
  CONSTRAINT tournament_participants_total_time_ms_nonneg CHECK (total_time_ms >= 0),
  CONSTRAINT tournament_participants_rank_final_positive CHECK (rank_final IS NULL OR rank_final > 0)
);

CREATE INDEX idx_tournament_participants_user_id
ON tournament_participants (user_id);

CREATE INDEX idx_tournament_participants_leaderboard
ON tournament_participants (tournament_id, total_score DESC, total_time_ms ASC);


CREATE TABLE tournament_round_participants (
  round_id uuid NOT NULL,
  tournament_id uuid NOT NULL,
  quiz_version_id uuid NOT NULL,
  user_id uuid NOT NULL,
  attempt_id uuid NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  round_score int NOT NULL DEFAULT 0,
  round_time_ms int NOT NULL DEFAULT 0,
  rank_in_round smallint,
  is_qualified boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (round_id, user_id),
  CONSTRAINT tournament_round_participants_round_score_nonneg CHECK (round_score >= 0),
  CONSTRAINT tournament_round_participants_round_time_ms_nonneg CHECK (round_time_ms >= 0),
  CONSTRAINT tournament_round_participants_rank_positive CHECK (rank_in_round IS NULL OR rank_in_round > 0),
  CONSTRAINT fk_tournament_round_participants_tournament_participant
    FOREIGN KEY (tournament_id, user_id)
    REFERENCES tournament_participants (tournament_id, user_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_tournament_round_participants_round_tournament
    FOREIGN KEY (round_id, tournament_id)
    REFERENCES tournament_rounds (round_id, tournament_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_tournament_round_participants_round_quiz_version
    FOREIGN KEY (round_id, quiz_version_id)
    REFERENCES tournament_rounds (round_id, quiz_version_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_tournament_round_participants_attempt_user
    FOREIGN KEY (attempt_id, user_id)
    REFERENCES quiz_attempts (attempt_id, user_id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_tournament_round_participants_attempt_version
    FOREIGN KEY (attempt_id, quiz_version_id)
    REFERENCES quiz_attempts (attempt_id, quiz_version_id)
    ON DELETE RESTRICT
);

CREATE INDEX idx_tournament_round_participants_user_id
ON tournament_round_participants (user_id);

CREATE INDEX idx_tournament_round_participants_round_leaderboard
ON tournament_round_participants (round_id, round_score DESC, round_time_ms ASC);
