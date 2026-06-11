ALTER TABLE "user_ranking" ADD COLUMN "daily_rank" integer;--> statement-breakpoint
ALTER TABLE "user_ranking" ADD COLUMN "last_daily_reset_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_ranking" ADD COLUMN "peak_daily_rank" integer;--> statement-breakpoint
ALTER TABLE "user_ranking" ADD COLUMN "peak_daily_rank_achieved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_ranking" ADD COLUMN "daily_xp" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_user_ranking_daily_rank" ON "user_ranking" USING btree ("daily_rank" int4_ops);--> statement-breakpoint
ALTER TABLE "user_ranking" ADD CONSTRAINT "user_ranking_daily_xp_nonneg" CHECK (daily_xp >= 0);--> statement-breakpoint
ALTER TABLE "user_ranking" ADD CONSTRAINT "user_ranking_daily_rank_positive" CHECK ((daily_rank IS NULL) OR (daily_rank > 0));