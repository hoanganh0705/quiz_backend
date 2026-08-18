// =============================================================================
// Taxonomy bounded context — schema
//
// Owns the hierarchical/folksonomic classification surface:
//   - categories             (curated, hierarchical taxonomy tree)
//   - tags                   (free-form folksonomy labels)
//   - categoryFollows        (user → category follow-through table)
//   - tagFollows             (user → tag follow-through table)
//
// Both follow tables use soft-delete + a partial unique index so that
// re-following a previously unfollowed entry restores the existing row
// instead of inserting a duplicate (a hard unique constraint would
// block that pattern).
//
// Cross-domain FKs
//   - users (auth)           — categoryFollows.userId, tagFollows.userId
//
// Internal ordering note
//   `categoryFollows` and `tagFollows` reference `categories` / `tags`
//   directly. The lazy FK evaluation pattern (see `ForeignKeyBuilder`'s
//   callback config) means declaring them in the same file in any order
//   works, but we list catalog tables first for readability.
// =============================================================================

import {
  pgTable,
  index,
  uniqueIndex,
  check,
  uuid,
  text,
  timestamp,
  foreignKey,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { users } from '../auth/schema';

// =============================================================================
// categories
// =============================================================================

export const categories = pgTable(
  'categories',
  {
    categoryId: uuid('category_id')
      .default(sql`uuidv7()`)
      .primaryKey()
      .notNull(),
    name: text().notNull(),
    description: text(),
    slug: text().notNull(),
    imageUrl: text('image_url'),
    /**
     * Reserved (out of scope for Phase 4). Added now so the future
     * category-image feature can write to it without a schema
     * migration. The application never writes to this column.
     */
    imagePublicId: text('image_public_id'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  (table) => [
    index('idx_categories_active_created_at')
      .using('btree', table.createdAt.asc().nullsLast().op('timestamptz_ops'))
      .where(sql`(deleted_at IS NULL)`),
    uniqueIndex('uq_categories_name_active')
      .using('btree', sql`lower(name)`)
      .where(sql`(deleted_at IS NULL)`),
    uniqueIndex('uq_categories_slug_active')
      .using('btree', table.slug.asc().nullsLast().op('text_ops'))
      .where(sql`(deleted_at IS NULL)`),
    check('categories_name_nonblank', sql`length(btrim(name)) > 0`),
    check(
      'categories_slug_format',
      sql`(slug = lower(slug)) AND (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'::text)`,
    ),
  ],
);

// =============================================================================
// tags
// =============================================================================

export const tags = pgTable(
  'tags',
  {
    tagId: uuid('tag_id')
      .default(sql`uuidv7()`)
      .primaryKey()
      .notNull(),
    name: text().notNull(),
    slug: text().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  (table) => [
    index('idx_tags_active_created_at')
      .using('btree', table.createdAt.asc().nullsLast().op('timestamptz_ops'))
      .where(sql`(deleted_at IS NULL)`),
    uniqueIndex('uq_tags_name_active')
      .using('btree', sql`lower(name)`)
      .where(sql`(deleted_at IS NULL)`),
    uniqueIndex('uq_tags_slug_active')
      .using('btree', table.slug.asc().nullsLast().op('text_ops'))
      .where(sql`(deleted_at IS NULL)`),
    check('tags_name_nonblank', sql`length(btrim(name)) > 0`),
    check(
      'tags_slug_format',
      sql`(slug = lower(slug)) AND (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'::text)`,
    ),
  ],
);

// =============================================================================
// categoryFollows
// =============================================================================

export const categoryFollows = pgTable(
  'category_follows',
  {
    followId: uuid('follow_id')
      .default(sql`uuidv7()`)
      .primaryKey()
      .notNull(),
    userId: uuid('user_id').notNull(),
    categoryId: uuid('category_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  (table) => [
    // Enforce at most one active follow per (user, category)
    uniqueIndex('uq_category_follows_user_category_active')
      .using(
        'btree',
        table.userId.asc().nullsLast().op('uuid_ops'),
        table.categoryId.asc().nullsLast().op('uuid_ops'),
      )
      .where(sql`deleted_at IS NULL`),
    index('idx_category_follows_user_id').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops'),
    ),
    index('idx_category_follows_category_id').using(
      'btree',
      table.categoryId.asc().nullsLast().op('uuid_ops'),
    ),
    index('idx_category_follows_deleted_at').using(
      'btree',
      table.deletedAt.asc().nullsLast().op('timestamptz_ops'),
    ),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.userId],
      name: 'category_follows_user_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.categoryId],
      foreignColumns: [categories.categoryId],
      name: 'category_follows_category_id_fkey',
    }).onDelete('cascade'),
  ],
);

// =============================================================================
// tagFollows
// =============================================================================

export const tagFollows = pgTable(
  'tag_follows',
  {
    followId: uuid('follow_id')
      .default(sql`uuidv7()`)
      .primaryKey()
      .notNull(),
    userId: uuid('user_id').notNull(),
    tagId: uuid('tag_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  (table) => [
    uniqueIndex('uq_tag_follows_user_tag_active')
      .using(
        'btree',
        table.userId.asc().nullsLast().op('uuid_ops'),
        table.tagId.asc().nullsLast().op('uuid_ops'),
      )
      .where(sql`deleted_at IS NULL`),
    index('idx_tag_follows_user_id').using('btree', table.userId.asc().nullsLast().op('uuid_ops')),
    index('idx_tag_follows_tag_id').using('btree', table.tagId.asc().nullsLast().op('uuid_ops')),
    index('idx_tag_follows_deleted_at').using(
      'btree',
      table.deletedAt.asc().nullsLast().op('timestamptz_ops'),
    ),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.userId],
      name: 'tag_follows_user_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.tagId],
      foreignColumns: [tags.tagId],
      name: 'tag_follows_tag_id_fkey',
    }).onDelete('cascade'),
  ],
);
