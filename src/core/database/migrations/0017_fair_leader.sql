CREATE TABLE "category_follows" (
	"follow_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "category_follows" ADD CONSTRAINT "category_follows_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_follows" ADD CONSTRAINT "category_follows_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("category_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_category_follows_user_category_active" ON "category_follows" USING btree ("user_id" uuid_ops,"category_id" uuid_ops) WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_category_follows_user_id" ON "category_follows" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_category_follows_category_id" ON "category_follows" USING btree ("category_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_category_follows_deleted_at" ON "category_follows" USING btree ("deleted_at" timestamptz_ops);