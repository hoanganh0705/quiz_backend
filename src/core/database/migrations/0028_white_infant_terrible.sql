CREATE TABLE "idempotency_keys" (
	"key" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"operation" varchar(64) NOT NULL,
	"response" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tournament_stats" (
	"tournament_id" uuid PRIMARY KEY NOT NULL,
	"participants" integer DEFAULT 0 NOT NULL,
	"completed_participants" integer DEFAULT 0 NOT NULL,
	"average_score" numeric(10, 2) DEFAULT '0',
	"highest_score" integer,
	"lowest_score" integer,
	"completion_rate" numeric(5, 2) DEFAULT '0',
	"average_rank" numeric(10, 2),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "quiz_reviews" ADD COLUMN "helpful_count" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "tournament_stats" ADD CONSTRAINT "tournament_stats_tournament_id_tournaments_tournament_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("tournament_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_idempotency_keys_expires_at" ON "idempotency_keys" USING btree ("expires_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_idempotency_keys_user_operation" ON "idempotency_keys" USING btree ("user_id" uuid_ops,"operation" text_ops);--> statement-breakpoint
CREATE INDEX "idx_quiz_reviews_quiz_rating" ON "quiz_reviews" USING btree ("quiz_id" uuid_ops,"rating" int2_ops);