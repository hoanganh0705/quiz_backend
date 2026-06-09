CREATE TYPE "public"."social_feed_activity_type" AS ENUM('badge_earned', 'badge_revoked', 'rank_milestone', 'peak_rank_achieved', 'tournament_joined', 'tournament_completed', 'tournament_won', 'discussion_created', 'discussion_solved');--> statement-breakpoint
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
ALTER TABLE "social_feed_activities" ADD CONSTRAINT "social_feed_activities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_social_feed_activities_occurred" ON "social_feed_activities" USING btree ("occurred_at" timestamptz_ops,"activity_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_social_feed_activities_user_occurred" ON "social_feed_activities" USING btree ("user_id" uuid_ops,"occurred_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_social_feed_activities_type_occurred" ON "social_feed_activities" USING btree ("activity_type" enum_ops,"occurred_at" timestamptz_ops);