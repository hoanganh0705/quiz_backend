ALTER TABLE "discussion_threads"
ADD COLUMN "is_solved" boolean DEFAULT false NOT NULL,
ADD COLUMN "solved_at" timestamp with time zone,
ADD COLUMN "solved_comment_id" uuid,
ADD COLUMN "solved_by" uuid;
--> statement-breakpoint
ALTER TABLE "discussion_threads" ADD CONSTRAINT "discussion_threads_solved_comment_id_fkey" FOREIGN KEY ("solved_comment_id") REFERENCES "public"."discussion_comments"("comment_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_threads" ADD CONSTRAINT "discussion_threads_solved_by_fkey" FOREIGN KEY ("solved_by") REFERENCES "public"."users"("user_id") ON DELETE set null ON UPDATE no action;