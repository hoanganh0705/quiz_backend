CREATE TABLE "oauth_accounts" (
	"oauth_account_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outbox_events" (
	"event_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"aggregate_type" text NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_oauth_accounts_provider_provider_user_id" ON "oauth_accounts" USING btree ("provider" text_ops,"provider_user_id" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_oauth_accounts_user_id_provider" ON "oauth_accounts" USING btree ("user_id" uuid_ops,"provider" text_ops);--> statement-breakpoint
CREATE INDEX "idx_oauth_accounts_user_id" ON "oauth_accounts" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_outbox_events_unprocessed" ON "outbox_events" USING btree ("processed_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_outbox_events_created" ON "outbox_events" USING btree ("created_at" timestamptz_ops);