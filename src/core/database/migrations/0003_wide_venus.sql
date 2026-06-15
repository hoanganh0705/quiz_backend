ALTER TYPE "public"."social_feed_activity_type" ADD VALUE 'quiz_completed';--> statement-breakpoint
ALTER TYPE "public"."social_feed_activity_type" ADD VALUE 'quiz_milestone';--> statement-breakpoint
ALTER TYPE "public"."social_feed_activity_type" ADD VALUE 'instance_created';--> statement-breakpoint
ALTER TYPE "public"."social_feed_activity_type" ADD VALUE 'instance_joined';--> statement-breakpoint
ALTER TYPE "public"."social_feed_activity_type" ADD VALUE 'instance_completed';--> statement-breakpoint
CREATE TABLE "rank_recalculation_work_items" (
	"work_item_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"period" text NOT NULL,
	"enqueued_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rank_recalculation_work_items_period_valid" CHECK (period = ANY (ARRAY['daily'::text, 'weekly'::text, 'monthly'::text, 'all_time'::text]))
);
--> statement-breakpoint
CREATE TABLE "sent_verification_tokens" (
	"sent_token_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"token_hash" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rank_recalculation_work_items" ADD CONSTRAINT "rank_recalculation_work_items_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sent_verification_tokens" ADD CONSTRAINT "sent_verification_tokens_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_rank_recalculation_work_items_user_period" ON "rank_recalculation_work_items" USING btree ("user_id" uuid_ops,"period" text_ops);--> statement-breakpoint
CREATE INDEX "idx_rank_recalculation_work_items_enqueued" ON "rank_recalculation_work_items" USING btree ("enqueued_at" timestamptz_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_sent_verification_tokens_hash" ON "sent_verification_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "idx_sent_verification_tokens_expires" ON "sent_verification_tokens" USING btree ("expires_at" timestamptz_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_outbox_events_idempotency_unprocessed" ON "outbox_events" USING btree ("idempotency_key" text_ops) WHERE processed_at IS NULL AND idempotency_key IS NOT NULL;