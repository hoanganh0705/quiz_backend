ALTER TYPE "public"."notification_type" ADD VALUE 'badge_revoked' BEFORE 'tournament_started';--> statement-breakpoint
CREATE TABLE "auth_audit_logs" (
	"audit_log_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"event_type" text NOT NULL,
	"ip_address" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "auth_audit_logs_metadata_object" CHECK (jsonb_typeof(metadata) = 'object'::text)
);
--> statement-breakpoint
DROP INDEX "idx_discussion_threads_search_vector";--> statement-breakpoint
ALTER TABLE "outbox_events" ADD COLUMN "attempt_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "outbox_events" ADD COLUMN "last_attempt_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "outbox_events" ADD COLUMN "next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "outbox_events" ADD COLUMN "last_error" text;--> statement-breakpoint
ALTER TABLE "auth_audit_logs" ADD CONSTRAINT "auth_audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_auth_audit_logs_created" ON "auth_audit_logs" USING btree ("created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_auth_audit_logs_expires" ON "auth_audit_logs" USING btree ("expires_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_auth_audit_logs_user_created" ON "auth_audit_logs" USING btree ("user_id" uuid_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_outbox_events_next_attempt" ON "outbox_events" USING btree ("processed_at" timestamptz_ops,"next_attempt_at" timestamptz_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_discussion_threads_search_vector" ON "discussion_threads" USING gin ("discussion_search_vector") WHERE deleted_at IS NULL;