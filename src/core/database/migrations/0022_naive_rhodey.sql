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
ALTER TABLE "user_ranking" ADD COLUMN "peak_all_time_rank_achieved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_ranking" ADD COLUMN "peak_weekly_rank_achieved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_ranking" ADD COLUMN "peak_monthly_rank_achieved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ranking_milestones" ADD CONSTRAINT "ranking_milestones_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ranking_milestones_user_id" ON "ranking_milestones" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_ranking_milestones_achieved_at" ON "ranking_milestones" USING btree ("achieved_at" timestamptz_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_ranking_milestones_user_milestone" ON "ranking_milestones" USING btree ("user_id" uuid_ops,"milestone" text_ops);--> statement-breakpoint
ALTER TABLE "user_ranking" DROP COLUMN "peak_rank_achieved_at";