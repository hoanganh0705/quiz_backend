ALTER TABLE "quiz_instance_players" DROP CONSTRAINT "quiz_instance_players_status_check";--> statement-breakpoint
CREATE INDEX "idx_quiz_instance_players_instance_status" ON "quiz_instance_players" USING btree ("instance_id" uuid_ops,"status" text_ops);--> statement-breakpoint
ALTER TABLE "quiz_instance_players" ADD CONSTRAINT "quiz_instance_players_status_check" CHECK (status = ANY (
        ARRAY[
          'joined'::text,
          'ready'::text,
          'playing'::text,
          'disconnected'::text,
          'finished'::text
        ]
      ));