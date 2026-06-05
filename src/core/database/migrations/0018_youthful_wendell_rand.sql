CREATE TABLE "tag_follows" (
	"follow_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "tag_follows" ADD CONSTRAINT "tag_follows_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tag_follows" ADD CONSTRAINT "tag_follows_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("tag_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_tag_follows_user_tag_active" ON "tag_follows" USING btree ("user_id" uuid_ops,"tag_id" uuid_ops) WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_tag_follows_user_id" ON "tag_follows" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_tag_follows_tag_id" ON "tag_follows" USING btree ("tag_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_tag_follows_deleted_at" ON "tag_follows" USING btree ("deleted_at" timestamptz_ops);