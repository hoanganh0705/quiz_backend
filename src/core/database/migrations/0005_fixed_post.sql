CREATE TYPE "public"."user_role" AS ENUM('admin', 'moderator', 'creator', 'user');--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD COLUMN "score_percent" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD COLUMN "correct_count" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" "user_role" DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_score_percent_range" CHECK (score_percent IS NULL OR (score_percent >= 0 AND score_percent <= 100));--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_correct_count_nonneg" CHECK (correct_count IS NULL OR correct_count >= 0);