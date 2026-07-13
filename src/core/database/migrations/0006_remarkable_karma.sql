ALTER TABLE "quizzes" ADD COLUMN "category_id" uuid;--> statement-breakpoint

UPDATE "quizzes" AS q
SET "category_id" = qc."category_id"
FROM (
  SELECT DISTINCT ON ("quiz_id") "quiz_id", "category_id"
  FROM "quiz_categories"
  ORDER BY "quiz_id", "category_id"
) AS qc
WHERE q."quiz_id" = qc."quiz_id";--> statement-breakpoint

DROP TABLE "quiz_categories" CASCADE;--> statement-breakpoint

ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("category_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

CREATE INDEX "idx_quizzes_category_id" ON "quizzes" USING btree ("category_id" uuid_ops) WHERE (category_id IS NOT NULL);