-- Phase 4 / Cloudinary migration — storage_assets + *_public_id columns.
--
-- Adds the durable ownership binding that backs the §11 ownership rule:
--
--   storage_assets   (one row per Cloudinary asset uploaded via the app)
--
--     id            uuidv7 PK (matches every other PK in this schema)
--     public_id     Cloudinary public_id (UNIQUE)
--     owner_id      the uploader (users.id, ON DELETE CASCADE)
--     purpose       'avatar' | 'quiz' (CHECK-constrained)
--     created_at    timestamptz DEFAULT now()
--
-- plus the columns that store the public_id of the asset attached to
-- an entity, so that the lifecycle (Phase 6) can know the *previous*
-- public_id and delete it on replace/remove:
--
--   user_profiles.avatar_public_id   (text NULL)
--   quizzes.image_public_id         (text NULL)
--   quiz_questions.image_public_id  (text NULL — reserved; not written)
--   categories.image_public_id      (text NULL — reserved; not written)
--
-- The columns are deliberately nullable and additive: existing rows
-- continue to render through `avatar_url` / `image_url`, and only
-- newly-written rows (post Phase 6) populate `*_public_id`. The
-- migrate-on-write window (Phase 7) keeps this non-destructive.
--
-- Note: drizzle-kit's diff baseline is the missing 0001 snapshot (the
-- 0001 migration was hand-written before this revision); it would
-- otherwise emit re-CREATEs for the flair/quiz_suppression tables
-- here. Those lines have been trimmed because they already exist
-- from 0001_coin_spend_side_tables.sql. The corresponding
-- 0002_snapshot.json encodes the schema state that includes them.
CREATE TABLE "storage_assets" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"public_id" text NOT NULL,
	"owner_id" uuid NOT NULL,
	"purpose" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "storage_assets_purpose_check" CHECK (purpose = ANY (ARRAY['avatar'::text, 'quiz'::text]))
);
--> statement-breakpoint
ALTER TABLE "storage_assets" ADD CONSTRAINT "storage_assets_owner_id_users_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_storage_assets_public_id" ON "storage_assets" USING btree ("public_id" text_ops);
--> statement-breakpoint
CREATE INDEX "idx_storage_assets_owner_id" ON "storage_assets" USING btree ("owner_id" uuid_ops);
--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "avatar_public_id" text;
--> statement-breakpoint
ALTER TABLE "quizzes" ADD COLUMN "image_public_id" text;
--> statement-breakpoint
ALTER TABLE "quiz_questions" ADD COLUMN "image_public_id" text;
--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "image_public_id" text;