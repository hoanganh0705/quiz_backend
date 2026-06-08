ALTER TABLE "rank_history" DROP CONSTRAINT "rank_history_period_valid";--> statement-breakpoint
DROP INDEX "idx_rank_history_created_at";--> statement-breakpoint
ALTER TABLE "discussion_threads" ADD COLUMN "is_solved" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "discussion_threads" ADD COLUMN "solved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "discussion_threads" ADD COLUMN "solved_comment_id" uuid;--> statement-breakpoint
ALTER TABLE "discussion_threads" ADD COLUMN "solved_by" uuid;--> statement-breakpoint
ALTER TABLE "rank_history" ADD COLUMN "snapshot_date" timestamp with time zone NOT NULL;--> statement-breakpoint
ALTER TABLE "rank_history" ADD COLUMN "rank" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "rank_history" ADD COLUMN "xp" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "rank_history" ADD COLUMN "recorded_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "tournament_participants" ADD COLUMN "withdrawn_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "discussion_threads" ADD CONSTRAINT "discussion_threads_solved_comment_id_fkey" FOREIGN KEY ("solved_comment_id") REFERENCES "public"."discussion_comments"("comment_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_threads" ADD CONSTRAINT "discussion_threads_solved_by_fkey" FOREIGN KEY ("solved_by") REFERENCES "public"."users"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_rank_history_snapshot_date" ON "rank_history" USING btree ("snapshot_date" timestamptz_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_rank_history_user_period_snapshot" ON "rank_history" USING btree ("user_id" uuid_ops,"period" text_ops,"snapshot_date" timestamptz_ops);--> statement-breakpoint
ALTER TABLE "rank_history" DROP COLUMN "period_start";--> statement-breakpoint
ALTER TABLE "rank_history" DROP COLUMN "period_end";--> statement-breakpoint
ALTER TABLE "rank_history" DROP COLUMN "xp_at_start";--> statement-breakpoint
ALTER TABLE "rank_history" DROP COLUMN "xp_at_end";--> statement-breakpoint
ALTER TABLE "rank_history" DROP COLUMN "rank_at_end";--> statement-breakpoint
ALTER TABLE "rank_history" DROP COLUMN "peak_rank";--> statement-breakpoint
ALTER TABLE "rank_history" DROP COLUMN "peak_xp";--> statement-breakpoint
ALTER TABLE "rank_history" DROP COLUMN "created_at";--> statement-breakpoint
ALTER TABLE "rank_history" ADD CONSTRAINT "rank_history_period_valid" CHECK (period = ANY (ARRAY['daily'::text, 'weekly'::text, 'monthly'::text, 'all_time'::text]));