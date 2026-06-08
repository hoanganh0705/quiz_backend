CREATE TYPE "public"."review_report_status" AS ENUM('open', 'reviewed', 'dismissed', 'actioned');--> statement-breakpoint
CREATE TABLE "discussion_thread_subscriptions" (
	"user_id" uuid NOT NULL,
	"thread_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_helpful_votes" (
	"vote_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_reports" (
	"report_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_id" uuid NOT NULL,
	"reporter_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"details" text,
	"status" "review_report_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_reports_reason_nonblank" CHECK (length(btrim(reason)) > 0)
);
--> statement-breakpoint
ALTER TABLE "discussion_thread_subscriptions" ADD CONSTRAINT "discussion_thread_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_thread_subscriptions" ADD CONSTRAINT "discussion_thread_subscriptions_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."discussion_threads"("thread_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_helpful_votes" ADD CONSTRAINT "review_helpful_votes_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "public"."quiz_reviews"("review_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_helpful_votes" ADD CONSTRAINT "review_helpful_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_reports" ADD CONSTRAINT "review_reports_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "public"."quiz_reviews"("review_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_reports" ADD CONSTRAINT "review_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_discussion_thread_subscriptions_user_thread" ON "discussion_thread_subscriptions" USING btree ("user_id" uuid_ops,"thread_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_discussion_thread_subscriptions_user_created" ON "discussion_thread_subscriptions" USING btree ("user_id" uuid_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_discussion_thread_subscriptions_thread" ON "discussion_thread_subscriptions" USING btree ("thread_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_review_helpful_votes_review_user" ON "review_helpful_votes" USING btree ("review_id" uuid_ops,"user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_review_helpful_votes_review_id" ON "review_helpful_votes" USING btree ("review_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_review_helpful_votes_user_id" ON "review_helpful_votes" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_review_reports_review_reporter" ON "review_reports" USING btree ("review_id" uuid_ops,"reporter_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_review_reports_status_created" ON "review_reports" USING btree ("status" enum_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_review_reports_review_id" ON "review_reports" USING btree ("review_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_review_reports_reporter_id" ON "review_reports" USING btree ("reporter_id" uuid_ops);