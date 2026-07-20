-- 0017 — Phase 1 / Issue #2: tournament ownership column.
--
-- The previous tournaments schema had no way to attribute a tournament
-- to the user who created it. That meant:
--
--   * No "owner can edit own tournament, admin can edit any"
--     authorization anchor — every admin only had the `TOURNAMENT_CREATE`
--     permission, and there was no escalation path for moderation
--     (see audit Issue #1, Issue #2).
--   * Audit logs (`event: 'tournament_created'` in
--     `tournament.service.ts`) recorded `userId: user.sub`, but no DB
--     row did.
--   * Once Phase 1 adds `PATCH /tournaments/:id`, `DELETE /tournaments/:id`
--     and `POST /tournaments/:id/cancel`, every authorization check
--     needs a stable ownership column to compare against.
--
-- The new endpoints enforce the rule "the column owner, or anyone with
-- `TOURNAMENT_EDIT_ANY`, can mutate". The column is therefore added
-- here, **NOT NULL**, with a one-shot backfill of existing rows to a
-- dedicated system actor (`system@quiz.local`). The system actor is
-- seeded by this same migration so the migration is self-contained and
-- does not depend on any other migration's order in the journal.
--
-- Why a dedicated system actor
-- ----------------------------
--
-- Two viable backfill strategies were considered:
--
--   1. Add the column as `NOT NULL DEFAULT '<unknown>'`, rely on a
--      brand-new column default that is never used again. Simple but
--      a future `ALTER TABLE ... DROP DEFAULT` plus a type change
--      becomes a multi-step migration.
--
--   2. Seed a real `users` row owned by no human, then backfill the
--      tournament column to that row's UUID. Lets the column stay
--      FK-constrained and `NOT NULL` with no special defaults.
--
-- This module uses option 2 because:
--
--   * It mirrors how every other module in the repo handles "rows
--     attributed to no real user" (e.g. `discussions.user_id` always
--     points at a real user row).
--   * The system actor is also useful as a future "automated workflow
--     runner" identity for scheduled jobs that need a non-null
--     `user_id` to satisfy existing FKs.
--
-- Idempotency
-- -----------
--
-- Every DDL uses `IF [NOT] EXISTS` (or `DROP ... IF EXISTS`) and the
-- INSERT uses ON CONFLICT DO NOTHING. Operators can safely re-run this
-- migration on a database that already has the column and the system
-- actor.
--
-- Pre-existing data
-- -----------------
--
-- Every existing `tournaments` row created before this migration was
-- created by an `admin` user, but that user's UUID was not captured.
-- After this migration completes, every such row is attributed to the
-- system actor. Once Phase 1 ships ownership enforcement,
-- `TOURNAMENT_EDIT_OWN` cannot be used on these rows (only
-- `TOURNAMENT_EDIT_ANY` — the admin permission path) — that is the
-- documented behavior.

BEGIN;

-- 1. Seed the system actor. `ON CONFLICT DO NOTHING` makes this safe
--    to re-run; the PK on `users.user_id` is the conflict target.
--
--    The password hash is not meaningful — the system actor never logs
--    in. A fixed garbage string satisfies `users.password_hash NOT NULL`.
--    `email_verified_at` is set to `NOW()` so the row survives the
--    `users_email_len` / `users_email_like` CHECK constraints that the
--    `users` table has.
--
--    Note: the `users` table has `username` CHECK length 3..50; the
--    string "system" satisfies it (length 6). `email` CHECK requires
--    `@` past position 1 and length 3..255; `system@quiz.local`
--    satisfies both. `role` is `'admin'` because the system actor is
--    only used as a backfill identity, not to grant privileges.
INSERT INTO users (
  user_id,
  username,
  email,
  password_hash,
  role,
  is_verified,
  email_verified_at,
  created_at,
  updated_at
)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'system',
  'system@quiz.local',
  '!disabled',
  'admin',
  true,
  NOW(),
  NOW(),
  NOW()
)
ON CONFLICT (user_id) DO NOTHING;

-- 2. Add the column nullable so we can backfill safely without holding
--    a table-level lock until the UPDATE completes.
ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS owner_user_id uuid;

-- 3. FK only after the column exists and is populated. ON DELETE
--    RESTRICT — dropping the owning user must fail if the user owns
--    tournaments, mirroring how `tournament_participants_user_id_fkey`
--    protects the participant rows.
--
--    The IF NOT EXISTS guard around the constraint name makes the
--    migration safe to re-run on a partially-applied database.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tournaments_owner_user_id_fkey'
      AND conrelid = 'tournaments'::regclass
  ) THEN
    ALTER TABLE tournaments
      ADD CONSTRAINT tournaments_owner_user_id_fkey
      FOREIGN KEY (owner_user_id) REFERENCES users(user_id)
      ON DELETE RESTRICT;
  END IF;
END
$$;

-- 4. Backfill any pre-existing rows (added before the migration ran)
--    to the system actor. The `IS NULL` predicate makes a re-run a
--    no-op — rows already attributed to a real user are left alone.
UPDATE tournaments
   SET owner_user_id = '00000000-0000-0000-0000-000000000001'
 WHERE owner_user_id IS NULL;

-- 5. Enforce NOT NULL now that every row has an owner.
ALTER TABLE tournaments
  ALTER COLUMN owner_user_id SET NOT NULL;

-- 6. Index the owner column. The two read paths that need it:
--
--    a. "List tournaments I own" — added by a future audit phase; the
--       planner needs an index on (owner_user_id, deleted_at IS NULL).
--    b. The `PATCH /tournaments/:id` and `DELETE /tournaments/:id`
--       routes — they hit the table by primary key, but an ownership
--       check benefits from a covering index that lets the planner
--       skip soft-deleted rows cheaply.
--
--    Both reads filter `deleted_at IS NULL`, so the partial index below
--    matches the existing `idx_tournaments_category_active` shape.
CREATE INDEX IF NOT EXISTS idx_tournaments_owner_active
  ON tournaments (owner_user_id)
  WHERE deleted_at IS NULL;

COMMIT;
