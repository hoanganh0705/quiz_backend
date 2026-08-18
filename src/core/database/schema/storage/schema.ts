// =============================================================================
// Storage bounded context — schema
//
// The single new table that records the binding between a Cloudinary
// `public_id` and its owner. This is the authoritative source the
// application consults before accepting any `avatarPublicId` /
// `imagePublicId` on a PATCH (see migration plan §6, §11).
//
// Why a dedicated table (and not piggy-backing on
// `user_profiles.avatar_public_id`):
//   - An asset is owned the moment it is uploaded, **before** the user
//     associates it with any entity.
//   - A user may upload several assets in a session and only associate
//     one; the others must still be owned (and deletable).
//   - The 4 columns below are the minimum needed to answer "is
//     `publicId` owned by `userId` and compatible with `purpose`?"
//
// `id` uses the project's uuidv7() default (matching every PK in this
// codebase) and is the row's primary identifier; `public_id` is the
// column the application indexes on for ownership lookups, so it
// carries a UNIQUE constraint (and an implicit UNIQUE BTREE index).
//
// `purpose` is a CHECK-constrained text column rather than an enum
// because (a) Cloudinary already enforces the value set elsewhere, and
// (b) extending the allowlist later is a single-line schema change
// without a destructive enum migration.
// =============================================================================

import { pgTable, index, uniqueIndex, check, uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { users } from '../auth/schema';

export const storageAssets = pgTable(
  'storage_assets',
  {
    id: uuid('id')
      .default(sql`uuidv7()`)
      .primaryKey()
      .notNull(),
    /**
     * The Cloudinary `public_id`, server-generated as
     * `${CLOUDINARY_FOLDER}/${purposeFolder}/${ownerId}/${uuidv7()}`.
     * UNIQUE — a collision implies either a duplicate upload (which we
     * treat as a bug) or a forged id (which we reject at the lookup).
     */
    publicId: text('public_id').notNull(),
    /** The `users.id` (UUID) that uploaded the asset. FK with cascade. */
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.userId, { onDelete: 'cascade' }),
    /**
     * The logical purpose ('avatar' | 'quiz'). Constrained at the DB
     * layer; the application enum (`UploadPurpose`) is the source of
     * truth and is enforced by the DTO + the storage adapter.
     */
    purpose: text('purpose').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('uq_storage_assets_public_id').using(
      'btree',
      table.publicId.asc().nullsLast().op('text_ops'),
    ),
    index('idx_storage_assets_owner_id').using(
      'btree',
      table.ownerId.asc().nullsLast().op('uuid_ops'),
    ),
    check('storage_assets_purpose_check', sql`purpose = ANY (ARRAY['avatar'::text, 'quiz'::text])`),
  ],
);
