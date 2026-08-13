-- Phase 6 / S-coin-spend migration.
--
-- Adds the per-user product tables that the spend endpoints write to
-- after the ledger row commits:
--
--   - user_flair_slots           (a 7-day profile flair slot)
--   - user_quiz_suppressions     (a 30-day hide-from-Recommended)
--
-- These tables are bounded-context-local to the coin economy. The wallet
-- / ledger / outbox tables introduced in Phase 1 (0000_initial_with_coins)
-- are unchanged.
CREATE TABLE "user_flair_slots" (
	"slot_id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"user_badge_id" uuid NOT NULL,
	"badge_id" uuid NOT NULL,
	"slot_start" timestamp with time zone DEFAULT now() NOT NULL,
	"slot_end" timestamp with time zone NOT NULL,
	"coin_transaction_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_flair_slots_slot_window" CHECK (slot_end > slot_start)
);
--> statement-breakpoint
CREATE TABLE "user_quiz_suppressions" (
	"suppression_id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"quiz_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"coin_transaction_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_user_flair_slots_active" ON "user_flair_slots" USING btree ("user_id" uuid_ops, "slot_end" timestamptz_ops);
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_user_flair_slots_coin_transaction_id" ON "user_flair_slots" USING btree ("coin_transaction_id" uuid_ops);
--> statement-breakpoint
CREATE INDEX "idx_user_quiz_suppressions_user_quiz" ON "user_quiz_suppressions" USING btree ("user_id" uuid_ops, "quiz_id" uuid_ops, "expires_at" timestamptz_ops);
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_user_quiz_suppressions_coin_transaction_id" ON "user_quiz_suppressions" USING btree ("coin_transaction_id" uuid_ops);
--> statement-breakpoint
ALTER TABLE "user_flair_slots" ADD CONSTRAINT "user_flair_slots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "user_flair_slots" ADD CONSTRAINT "user_flair_slots_user_badge_id_fkey" FOREIGN KEY ("user_badge_id") REFERENCES "public"."user_badges"("user_badge_id") ON DELETE restrict;
--> statement-breakpoint
ALTER TABLE "user_flair_slots" ADD CONSTRAINT "user_flair_slots_badge_id_fkey" FOREIGN KEY ("badge_id") REFERENCES "public"."badges"("badge_id") ON DELETE restrict;
--> statement-breakpoint
ALTER TABLE "user_quiz_suppressions" ADD CONSTRAINT "user_quiz_suppressions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "user_quiz_suppressions" ADD CONSTRAINT "user_quiz_suppressions_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "public"."quizzes"("quiz_id") ON DELETE cascade;
