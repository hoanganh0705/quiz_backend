CREATE INDEX "idx_bookmarked_quizzes_collection_bookmarked_at_desc"
ON "bookmarked_quizzes" USING btree ("collection_id" uuid_ops, "bookmarked_at" timestamptz_ops DESC, "bookmark_id" uuid_ops DESC);--> statement-breakpoint
