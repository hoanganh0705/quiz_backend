ALTER TABLE "user_sessions" ADD COLUMN "device_browser" text;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD COLUMN "device_os" text;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD COLUMN "device_type" text DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_sessions" DROP COLUMN "reuse_count";--> statement-breakpoint
ALTER TABLE "user_sessions" DROP COLUMN "device_info";