CREATE TYPE "quiz_difficulty" AS ENUM (
  'Easy',
  'Medium',
  'Hard'
);

CREATE TYPE "quiz_status" AS ENUM (
  'started',
  'completed',
  'abandoned'
);

CREATE TYPE "quiz_instance_status" AS ENUM (
  'open',
  'running',
  'closed',
  'finished'
);

CREATE TYPE "tournament_status" AS ENUM (
  'upcoming',
  'registration',
  'ongoing',
  'finished',
  'cancelled'
);

CREATE TYPE "tournament_round_status" AS ENUM (
  'pending',
  'open',
  'running',
  'finished'
);

CREATE TYPE "tournament_participant_status" AS ENUM (
  'active',
  'eliminated',
  'winner'
);

CREATE TYPE "quiz_instance_player_status" AS ENUM (
  'joined',
  'ready',
  'playing',
  'disconnected',
  'finished'
);

CREATE TYPE "result_status" AS ENUM (
  'passed',
  'failed',
  'abandoned'
);

CREATE TYPE "badge_type" AS ENUM (
  'Diamond',
  'Platinum',
  'Gold',
  'Silver',
  'Bronze'
);

CREATE TYPE "badge_condition_type" AS ENUM (
  'quizzes_completed',
  'quizzes_passed',
  'streak_days',
  'xp_earned',
  'tournaments_won',
  'perfect_score'
  -- add more as needed
);

CREATE TABLE "categories" (
  "category_id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "name" varchar(100) UNIQUE NOT NULL,
  "description" text,
  "slug" varchar(100) UNIQUE NOT NULL,
  "image_url" text,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now()),
  "deleted_at" timestamptz
);

CREATE TABLE "tags" (
  "tag_id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "name" varchar(50) UNIQUE NOT NULL,
  "slug" varchar(100) UNIQUE NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now()),
  "deleted_at" timestamptz
);

CREATE TABLE "users" (
  "user_id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "username" varchar(50) UNIQUE NOT NULL,
  "email" varchar(255) UNIQUE NOT NULL,
  "display_name" varchar(100),
  "avatar_url" text,
  "bio" text,
  "xp_total" int DEFAULT 0,
  "current_streak" int DEFAULT 0,
  "longest_streak" int DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now()),
  "deleted_at" timestamptz,
  "settings" jsonb DEFAULT ('{}')
);

CREATE TABLE "quizzes" (
  "quiz_id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "title" varchar(200) NOT NULL,
  "description" text,
  "duration" int NOT NULL,
  "difficulty" quiz_difficulty NOT NULL,
  "image" text,
  "passing_score" int DEFAULT 50,
  "creator_id" uuid,
  "reward" int DEFAULT 0,
  "requirements" text,
  "slug" varchar(100) UNIQUE NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now()),
  "deleted_at" timestamptz
);

-- cần lưu ý 
CREATE TABLE "quiz_stats" (
  "quiz_id" uuid PRIMARY KEY,
  "rating_avg" numeric(3,2) DEFAULT 0,
  "total_reviews" int DEFAULT 0,
  "total_attempts" int DEFAULT 0
);

CREATE TABLE "quiz_flags" (
  "quiz_id" uuid PRIMARY KEY,
  "is_featured" boolean DEFAULT false,
  "is_hidden" boolean DEFAULT false,
  "is_verified" boolean DEFAULT false
);

CREATE TABLE "quiz_instances" (
  "instance_id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "host_id" uuid NOT NULL,
  "quiz_id" uuid NOT NULL,
  "max_players" int,
  "status" quiz_instance_status,
  "started_at" timestamptz,
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "quiz_instance_players" (
  "instance_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "attempt_id" uuid,
  "current_score" int DEFAULT 0,
  "status" quiz_instance_player_status,
  "joined_at" timestamptz NOT NULL DEFAULT (now()),
  "left_at" timestamptz,
  PRIMARY KEY ("instance_id", "user_id")
);

CREATE TABLE "quiz_categories" (
  "quiz_id" uuid NOT NULL,
  "category_id" uuid NOT NULL,
  PRIMARY KEY ("quiz_id", "category_id")
);

CREATE TABLE "quiz_tags" (
  "quiz_id" uuid NOT NULL,
  "tag_id" uuid NOT NULL,
  PRIMARY KEY ("quiz_id", "tag_id")
);

CREATE TABLE "quiz_questions" (
  "question_id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "quiz_id" uuid NOT NULL,
  "question" text NOT NULL,
  "image" text,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz DEFAULT (now()),
  "deleted_at" timestamptz
);

CREATE TABLE "quiz_answer_options" (
  "option_id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "question_id" uuid NOT NULL,
  "value" text NOT NULL,
  "position" int NOT NULL,
  "is_correct" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "deleted_at" timestamptz
);

CREATE TABLE "quiz_attempts" (
  "attempt_id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "user_id" uuid NOT NULL,
  "quiz_id" uuid NOT NULL,
  "started_at" timestamptz NOT NULL,
  "completed_at" timestamptz,
  "time_taken_ms" int,
  "score" int NOT NULL DEFAULT 0,
  "correct_answers" smallint NOT NULL DEFAULT 0,
  "status" quiz_status NOT NULL DEFAULT 'started',
  "result_status" result_status,
  "xp_earned" int DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "user_quiz_answers" (
  "answer_id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "attempt_id" uuid NOT NULL,
  "question_id" uuid NOT NULL,
  "selected_option_id" uuid,
  "time_taken_ms" int,
  "is_correct" boolean NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "quiz_reviews" (
  "review_id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "quiz_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "rating" smallint CHECK (rating BETWEEN 1 AND 5),
  "comment" text,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "bookmark_collections" (
  "collection_id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "user_id" uuid NOT NULL,
  "name" varchar(100) NOT NULL,
  "description" text,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "bookmarked_quizzes" (
  "bookmark_id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "collection_id" uuid NOT NULL,
  "quiz_id" uuid NOT NULL,
  "bookmarked_at" timestamptz NOT NULL DEFAULT (now()),
  "notes" text,
  "updated_at" timestamptz DEFAULT (now())
);

CREATE TABLE "tournaments" (
  "tournament_id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "title" varchar(200) NOT NULL,
  "description" text,
  "difficulty" quiz_difficulty NOT NULL,
  "status" tournament_status,
  "prize" text,
  "start_date" timestamptz NOT NULL,
  "end_date" timestamptz NOT NULL,
  "registration_open" boolean DEFAULT true,
  "max_participants" int,
  "category_id" uuid,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now()),
  "deleted_at" timestamptz
);

CREATE TABLE "tournament_rounds" (
  "round_id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "tournament_id" uuid NOT NULL,
  "round_number" smallint NOT NULL,
  "name" varchar(100) NOT NULL,
  "description" text,
  "quiz_id" uuid NOT NULL,
  "start_time" timestamptz,
  "end_time" timestamptz,
  "duration" int,
  "status" tournament_round_status,
  "is_elimination" boolean DEFAULT false,
  "participant_limit" int,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "tournament_participants" (
  "tournament_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "registered_at" timestamptz NOT NULL DEFAULT (now()),
  "total_score" int DEFAULT 0,
  "total_time" int DEFAULT 0,
  "rank_final" smallint,
  "status" tournament_participant_status,
  PRIMARY KEY ("tournament_id", "user_id")
);

CREATE TABLE "tournament_round_participants" (
  "round_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "attempt_id" uuid,
  "round_score" int DEFAULT 0,
  "round_time" int DEFAULT 0,
  "rank_in_round" smallint,
  "is_qualified" boolean DEFAULT true,
  "joined_at" timestamptz NOT NULL DEFAULT (now()),
  PRIMARY KEY ("round_id", "user_id")
);

CREATE TABLE "badges" (
  "badge_id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "slug" varchar(100) UNIQUE NOT NULL,
  "type" badge_type NOT NULL,
  "name" varchar(150) NOT NULL,
  "description" text,
  "condition_type" badge_condition_type NOT NULL,
  "condition_value" int NOT NULL,
  "is_active" boolean DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "user_badges" (
  "user_id" uuid NOT NULL,
  "badge_id" uuid NOT NULL,
  "earned_at" timestamptz NOT NULL DEFAULT (now()),
  "metadata" jsonb DEFAULT ('{}'),
  PRIMARY KEY ("user_id", "badge_id")
);

CREATE INDEX ON "quiz_instance_players" ("instance_id");

CREATE INDEX ON "quiz_questions" ("quiz_id");

CREATE UNIQUE INDEX ON "quiz_answer_options" ("question_id", "position");

CREATE INDEX ON "quiz_attempts" ("status");

CREATE INDEX "idx_quiz_attempts_user_id" ON "quiz_attempts" ("user_id");

CREATE INDEX "idx_quiz_attempts_quiz_id" ON "quiz_attempts" ("quiz_id");

CREATE INDEX "idx_quiz_attempts_user_completed" ON "quiz_attempts" ("user_id", "completed_at");

CREATE UNIQUE INDEX ON "user_quiz_answers" ("attempt_id", "question_id");

CREATE INDEX ON "user_quiz_answers" ("question_id");

CREATE INDEX ON "user_quiz_answers" ("attempt_id");

CREATE UNIQUE INDEX ON "quiz_reviews" ("quiz_id", "user_id");

CREATE UNIQUE INDEX ON "bookmark_collections" ("user_id", "name");

CREATE INDEX ON "bookmark_collections" ("user_id");

CREATE UNIQUE INDEX ON "bookmarked_quizzes" ("collection_id", "quiz_id");

CREATE INDEX ON "bookmarked_quizzes" ("collection_id");

CREATE INDEX ON "bookmarked_quizzes" ("quiz_id");

CREATE INDEX ON "tournaments" ("status");

CREATE INDEX ON "tournaments" ("start_date");

CREATE INDEX ON "tournaments" ("category_id");

CREATE UNIQUE INDEX ON "tournament_rounds" ("tournament_id", "round_number");

CREATE INDEX ON "tournament_rounds" ("tournament_id");

CREATE INDEX ON "tournament_participants" ("user_id");

CREATE INDEX ON "tournament_round_participants" ("user_id");

CREATE INDEX ON "tournament_round_participants" ("round_id");

CREATE INDEX ON "badges" ("slug");

CREATE INDEX ON "badges" ("condition_type");

CREATE INDEX ON "user_badges" ("user_id");

CREATE INDEX ON "user_badges" ("badge_id");

COMMENT ON COLUMN "users"."username" IS 'min length 3';

COMMENT ON COLUMN "quiz_reviews"."rating" IS '1–5';

COMMENT ON COLUMN "quizzes"."duration" IS 'Duration in seconds';

COMMENT ON COLUMN "tournament_rounds"."duration" IS 'Duration in seconds';

COMMENT ON COLUMN "tournament_participants"."total_time" IS 'Total time taken in milliseconds';

COMMENT ON COLUMN "tournament_round_participants"."round_time" IS 'Time taken in milliseconds';


-- quizzes
ALTER TABLE "quizzes"
ADD FOREIGN KEY ("creator_id")
REFERENCES "users" ("user_id")
ON DELETE SET NULL;

ALTER TABLE "quizzes"
ADD CONSTRAINT "chk_passing_score" CHECK (passing_score BETWEEN 0 AND 100);

-- quiz_stats
ALTER TABLE "quiz_stats"
ADD FOREIGN KEY ("quiz_id")
REFERENCES "quizzes" ("quiz_id")
ON DELETE CASCADE;

-- quiz_flags
ALTER TABLE "quiz_flags"
ADD FOREIGN KEY ("quiz_id")
REFERENCES "quizzes" ("quiz_id")
ON DELETE CASCADE;

-- quiz_instances
ALTER TABLE "quiz_instances"
ADD FOREIGN KEY ("quiz_id")
REFERENCES "quizzes" ("quiz_id")
ON DELETE CASCADE;

ALTER TABLE "quiz_instances"
ADD FOREIGN KEY ("host_id") 
REFERENCES "users" ("user_id") 
ON DELETE CASCADE;

-- quiz_instance_players
ALTER TABLE "quiz_instance_players"
ADD FOREIGN KEY ("instance_id")
REFERENCES "quiz_instances" ("instance_id")
ON DELETE CASCADE;

ALTER TABLE "quiz_instance_players"
ADD FOREIGN KEY ("user_id")
REFERENCES "users" ("user_id")
ON DELETE CASCADE;

ALTER TABLE "quiz_instance_players"
ADD FOREIGN KEY ("attempt_id")
REFERENCES "quiz_attempts" ("attempt_id")
ON DELETE SET NULL;

-- quiz_categories
ALTER TABLE "quiz_categories"
ADD FOREIGN KEY ("quiz_id")
REFERENCES "quizzes" ("quiz_id")
ON DELETE CASCADE;

ALTER TABLE "quiz_categories"
ADD FOREIGN KEY ("category_id")
REFERENCES "categories" ("category_id")
ON DELETE CASCADE;

-- quiz_tags
ALTER TABLE "quiz_tags"
ADD FOREIGN KEY ("quiz_id")
REFERENCES "quizzes" ("quiz_id")
ON DELETE CASCADE;

ALTER TABLE "quiz_tags"
ADD FOREIGN KEY ("tag_id")
REFERENCES "tags" ("tag_id")
ON DELETE CASCADE;

-- quiz_questions
ALTER TABLE "quiz_questions"
ADD FOREIGN KEY ("quiz_id")
REFERENCES "quizzes" ("quiz_id")
ON DELETE CASCADE;

-- quiz_answer_options
ALTER TABLE "quiz_answer_options"
ADD FOREIGN KEY ("question_id")
REFERENCES "quiz_questions" ("question_id")
ON DELETE CASCADE;

-- quiz_attempts
ALTER TABLE "quiz_attempts"
ADD FOREIGN KEY ("user_id")
REFERENCES "users" ("user_id")
ON DELETE CASCADE;

ALTER TABLE "quiz_attempts"
ADD FOREIGN KEY ("quiz_id")
REFERENCES "quizzes" ("quiz_id")
ON DELETE CASCADE;

ALTER TABLE "quiz_attempts"
ADD CONSTRAINT "chk_score_non_negative" CHECK (score >= 0);

-- user_quiz_answers
ALTER TABLE "user_quiz_answers"
ADD FOREIGN KEY ("attempt_id")
REFERENCES "quiz_attempts" ("attempt_id")
ON DELETE CASCADE;

ALTER TABLE "user_quiz_answers"
ADD FOREIGN KEY ("question_id")
REFERENCES "quiz_questions" ("question_id")
ON DELETE CASCADE;

ALTER TABLE "user_quiz_answers"
ADD FOREIGN KEY ("selected_option_id")
REFERENCES "quiz_answer_options" ("option_id")
ON DELETE SET NULL;

-- quiz_reviews
ALTER TABLE "quiz_reviews"
ADD FOREIGN KEY ("quiz_id")
REFERENCES "quizzes" ("quiz_id")
ON DELETE CASCADE;

ALTER TABLE "quiz_reviews"
ADD FOREIGN KEY ("user_id")
REFERENCES "users" ("user_id")
ON DELETE CASCADE;


-- bookmark_collections
ALTER TABLE "bookmark_collections"
ADD FOREIGN KEY ("user_id")
REFERENCES "users" ("user_id")
ON DELETE CASCADE;

-- bookmarked_quizzes
ALTER TABLE "bookmarked_quizzes"
ADD FOREIGN KEY ("collection_id")
REFERENCES "bookmark_collections" ("collection_id")
ON DELETE CASCADE;

ALTER TABLE "bookmarked_quizzes"
ADD FOREIGN KEY ("quiz_id")
REFERENCES "quizzes" ("quiz_id")
ON DELETE CASCADE;

-- tournaments
ALTER TABLE "tournaments"
ADD FOREIGN KEY ("category_id")
REFERENCES "categories" ("category_id")
ON DELETE SET NULL;

-- tournament_rounds
ALTER TABLE "tournament_rounds"
ADD FOREIGN KEY ("tournament_id")
REFERENCES "tournaments" ("tournament_id")
ON DELETE CASCADE;

ALTER TABLE "tournament_rounds"
ADD FOREIGN KEY ("quiz_id")
REFERENCES "quizzes" ("quiz_id")
ON DELETE CASCADE;

-- tournament_participants
ALTER TABLE "tournament_participants"
ADD FOREIGN KEY ("tournament_id")
REFERENCES "tournaments" ("tournament_id")
ON DELETE CASCADE;

ALTER TABLE "tournament_participants"
ADD FOREIGN KEY ("user_id")
REFERENCES "users" ("user_id")
ON DELETE CASCADE;

-- tournament_round_participants
ALTER TABLE "tournament_round_participants"
ADD FOREIGN KEY ("round_id")
REFERENCES "tournament_rounds" ("round_id")
ON DELETE CASCADE;

ALTER TABLE "tournament_round_participants"
ADD FOREIGN KEY ("user_id")
REFERENCES "users" ("user_id")
ON DELETE CASCADE;

ALTER TABLE "tournament_round_participants"
ADD FOREIGN KEY ("attempt_id")
REFERENCES "quiz_attempts" ("attempt_id")
ON DELETE SET NULL;

-- user_badges
ALTER TABLE "user_badges"
ADD FOREIGN KEY ("user_id")
REFERENCES "users" ("user_id")
ON DELETE CASCADE;

ALTER TABLE "user_badges"
ADD FOREIGN KEY ("badge_id")
REFERENCES "badges" ("badge_id")
ON DELETE CASCADE;

