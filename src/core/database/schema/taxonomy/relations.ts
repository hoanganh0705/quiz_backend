// =============================================================================
// Taxonomy bounded context — relations
//
// All four taxonomy tables anchor on a small set of joins:
//   - tags are the catalog; both have many
//     follow-through rows
//   - *Follows tables each point back to their user and their
//     category/tag
//
// Cross-domain relations are imported via live bindings from the barrel
// (`..`) so this file can reference tables that are still inline
// (e.g. `quizzes`) without taking a hard import dependency. The relation
// callbacks in `relations()` are stored as functions, so the live
// bindings resolve at FK/relation-build time.
// =============================================================================

import { relations } from 'drizzle-orm/relations';

import { categories, categoryFollows, tagFollows, tags } from './schema';
import { users } from '../auth/schema';
import { quizTags, quizzes, tournaments } from '..';

export const categoriesRelations = relations(categories, ({ many }) => ({
  quizzes: many(quizzes, {
    relationName: 'quizzes_category_id_categories_category_id',
  }),
  tournaments: many(tournaments),
  categoryFollows: many(categoryFollows),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  quizTags: many(quizTags),
  tagFollows: many(tagFollows),
}));

export const categoryFollowsRelations = relations(categoryFollows, ({ one }) => ({
  user: one(users, {
    fields: [categoryFollows.userId],
    references: [users.userId],
  }),
  category: one(categories, {
    fields: [categoryFollows.categoryId],
    references: [categories.categoryId],
  }),
}));

export const tagFollowsRelations = relations(tagFollows, ({ one }) => ({
  user: one(users, {
    fields: [tagFollows.userId],
    references: [users.userId],
  }),
  tag: one(tags, {
    fields: [tagFollows.tagId],
    references: [tags.tagId],
  }),
}));
