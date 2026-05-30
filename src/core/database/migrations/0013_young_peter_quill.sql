CREATE TABLE "user_ranking" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"all_time_xp" integer DEFAULT 0 NOT NULL,
	"weekly_xp" integer DEFAULT 0 NOT NULL,
	"monthly_xp" integer DEFAULT 0 NOT NULL,
	"all_time_rank" integer,
	"weekly_rank" integer,
	"monthly_rank" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_ranking_all_time_xp_nonneg" CHECK (all_time_xp >= 0),
	CONSTRAINT "user_ranking_weekly_xp_nonneg" CHECK (weekly_xp >= 0),
	CONSTRAINT "user_ranking_monthly_xp_nonneg" CHECK (monthly_xp >= 0),
	CONSTRAINT "user_ranking_all_time_rank_positive" CHECK ((all_time_rank IS NULL) OR (all_time_rank > 0)),
	CONSTRAINT "user_ranking_weekly_rank_positive" CHECK ((weekly_rank IS NULL) OR (weekly_rank > 0)),
	CONSTRAINT "user_ranking_monthly_rank_positive" CHECK ((monthly_rank IS NULL) OR (monthly_rank > 0))
);
--> statement-breakpoint
ALTER TABLE "user_ranking" ADD CONSTRAINT "user_ranking_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_user_ranking_all_time_rank" ON "user_ranking" USING btree ("all_time_rank" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_user_ranking_weekly_rank" ON "user_ranking" USING btree ("weekly_rank" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_user_ranking_monthly_rank" ON "user_ranking" USING btree ("monthly_rank" int4_ops);