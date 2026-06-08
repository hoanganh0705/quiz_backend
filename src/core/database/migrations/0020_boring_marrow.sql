CREATE TABLE "discussion_saved_threads" (
	"user_id" uuid NOT NULL,
	"thread_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "discussion_saved_threads" ADD CONSTRAINT "discussion_saved_threads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_saved_threads" ADD CONSTRAINT "discussion_saved_threads_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."discussion_threads"("thread_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_discussion_saved_threads_user_thread" ON "discussion_saved_threads" USING btree ("user_id" uuid_ops,"thread_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_discussion_saved_threads_user_created" ON "discussion_saved_threads" USING btree ("user_id" uuid_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_discussion_saved_threads_thread" ON "discussion_saved_threads" USING btree ("thread_id" uuid_ops);