ALTER TABLE "user_sessions"
ADD COLUMN IF NOT EXISTS "revoked_at" timestamp with time zone;
