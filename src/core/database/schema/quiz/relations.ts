// =============================================================================
// Quiz bounded context — relations
//
// All relation blocks for the 15 quiz tables live here. Each `relations(...)`
// call uses callbacks (`one`, `many`), so cross-domain table imports from
// `..` (the barrel) are safe to use as live bindings even when the barrel
// has not yet finished evaluating.
//
// Cross-domain imports in this file:
//   - users (auth)              — quiz creators, hosts, reviewers, players
//   - discussionThreads         — declared by the discussion domain in a
//                                 later phase; imported here from the barrel
// =============================================================================

import { relations } from 'drizzle-orm/relations';

import {
  quizzes,
  quizVersions,
  quizQuestions,
  quizAnswerOptions,
  quizCategories,
  quizTags,
  quizStats,
  quizAttempts,
  quizAttemptAnswers,
  quizAttemptEvents,
  quizReviews,
  bookmarkCollections,
  bookmarkedQuizzes,
  quizInstances,
  quizInstancePlayers,
} from './schema';
import { users } from '../auth/schema';
import { categories, discussionThreads, tags } from '..';

export const quizzesRelations = relations(quizzes, ({ one, many }) => ({
  user: one(users, {
    fields: [quizzes.creatorId],
    references: [users.userId],
  }),
  quizVersion: one(quizVersions, {
    fields: [quizzes.publishedVersionId],
    references: [quizVersions.quizVersionId],
    relationName: 'quizzes_publishedVersionId_quizVersions_quizVersionId',
  }),
  quizVersions: many(quizVersions, {
    relationName: 'quizVersions_quizId_quizzes_quizId',
  }),
  quizCategories: many(quizCategories),
  quizTags: many(quizTags),
  quizStats: one(quizStats),
  quizReviews: many(quizReviews),
  bookmarkedQuizzes: many(bookmarkedQuizzes),
  discussionThreads: many(discussionThreads),
}));

export const quizVersionsRelations = relations(quizVersions, ({ one, many }) => ({
  quizzes: many(quizzes, {
    relationName: 'quizzes_publishedVersionId_quizVersions_quizVersionId',
  }),
  user: one(users, {
    fields: [quizVersions.createdByUserId],
    references: [users.userId],
  }),
  quiz: one(quizzes, {
    fields: [quizVersions.quizId],
    references: [quizzes.quizId],
    relationName: 'quizVersions_quizId_quizzes_quizId',
  }),
  quizQuestions: many(quizQuestions),
  quizAttempts: many(quizAttempts),
  quizInstances: many(quizInstances),
}));

export const quizQuestionsRelations = relations(quizQuestions, ({ one, many }) => ({
  quizVersion: one(quizVersions, {
    fields: [quizQuestions.quizVersionId],
    references: [quizVersions.quizVersionId],
  }),
  quizAnswerOptions: many(quizAnswerOptions),
  quizAttemptAnswers: many(quizAttemptAnswers),
  quizAttemptEvents: many(quizAttemptEvents),
}));

export const quizAnswerOptionsRelations = relations(quizAnswerOptions, ({ one, many }) => ({
  quizQuestion: one(quizQuestions, {
    fields: [quizAnswerOptions.questionId],
    references: [quizQuestions.questionId],
  }),
  quizAttemptAnswers: many(quizAttemptAnswers),
  quizAttemptEvents: many(quizAttemptEvents),
}));

export const quizCategoriesRelations = relations(quizCategories, ({ one }) => ({
  // `categories` (taxonomy) is still inline in the barrel. The relation here
  // uses the live binding from `..` — the callback is evaluated lazily so
  // the value will be resolved by the time Drizzle builds the relations.
  category: one(categories, {
    fields: [quizCategories.categoryId],
    references: [categories.categoryId],
  }),
  quiz: one(quizzes, {
    fields: [quizCategories.quizId],
    references: [quizzes.quizId],
  }),
}));

export const quizTagsRelations = relations(quizTags, ({ one }) => ({
  quiz: one(quizzes, {
    fields: [quizTags.quizId],
    references: [quizzes.quizId],
  }),
  tag: one(tags, {
    fields: [quizTags.tagId],
    references: [tags.tagId],
  }),
}));

export const quizStatsRelations = relations(quizStats, ({ one }) => ({
  quiz: one(quizzes, {
    fields: [quizStats.quizId],
    references: [quizzes.quizId],
  }),
}));

export const quizAttemptsRelations = relations(quizAttempts, ({ one, many }) => ({
  quizVersion: one(quizVersions, {
    fields: [quizAttempts.quizVersionId],
    references: [quizVersions.quizVersionId],
  }),
  user: one(users, {
    fields: [quizAttempts.userId],
    references: [users.userId],
  }),
  quizAttemptAnswers: many(quizAttemptAnswers),
  quizAttemptEvents: many(quizAttemptEvents),
  quizInstancePlayers: many(quizInstancePlayers),
}));

export const quizAttemptAnswersRelations = relations(quizAttemptAnswers, ({ one }) => ({
  quizAttempt: one(quizAttempts, {
    fields: [quizAttemptAnswers.attemptId],
    references: [quizAttempts.attemptId],
  }),
  quizQuestion: one(quizQuestions, {
    fields: [quizAttemptAnswers.questionId],
    references: [quizQuestions.questionId],
  }),
  quizAnswerOption: one(quizAnswerOptions, {
    fields: [quizAttemptAnswers.selectedOptionId],
    references: [quizAnswerOptions.optionId],
  }),
}));

export const quizAttemptEventsRelations = relations(quizAttemptEvents, ({ one }) => ({
  quizAttempt: one(quizAttempts, {
    fields: [quizAttemptEvents.attemptId],
    references: [quizAttempts.attemptId],
  }),
  quizQuestion: one(quizQuestions, {
    fields: [quizAttemptEvents.questionId],
    references: [quizQuestions.questionId],
  }),
  quizAnswerOption: one(quizAnswerOptions, {
    fields: [quizAttemptEvents.selectedOptionId],
    references: [quizAnswerOptions.optionId],
  }),
}));

export const quizReviewsRelations = relations(quizReviews, ({ one }) => ({
  quiz: one(quizzes, {
    fields: [quizReviews.quizId],
    references: [quizzes.quizId],
  }),
  user: one(users, {
    fields: [quizReviews.userId],
    references: [users.userId],
  }),
}));

export const bookmarkCollectionsRelations = relations(bookmarkCollections, ({ one, many }) => ({
  user: one(users, {
    fields: [bookmarkCollections.userId],
    references: [users.userId],
  }),
  bookmarkedQuizzes: many(bookmarkedQuizzes),
}));

export const bookmarkedQuizzesRelations = relations(bookmarkedQuizzes, ({ one }) => ({
  bookmarkCollection: one(bookmarkCollections, {
    fields: [bookmarkedQuizzes.collectionId],
    references: [bookmarkCollections.collectionId],
  }),
  quiz: one(quizzes, {
    fields: [bookmarkedQuizzes.quizId],
    references: [quizzes.quizId],
  }),
}));

export const quizInstancesRelations = relations(quizInstances, ({ one, many }) => ({
  user: one(users, {
    fields: [quizInstances.hostUserId],
    references: [users.userId],
  }),
  quizVersion: one(quizVersions, {
    fields: [quizInstances.quizVersionId],
    references: [quizVersions.quizVersionId],
  }),
  quizInstancePlayers: many(quizInstancePlayers),
}));

export const quizInstancePlayersRelations = relations(quizInstancePlayers, ({ one }) => ({
  quizAttempt: one(quizAttempts, {
    fields: [quizInstancePlayers.attemptId],
    references: [quizAttempts.attemptId],
  }),
  quizInstance: one(quizInstances, {
    fields: [quizInstancePlayers.instanceId],
    references: [quizInstances.instanceId],
  }),
  user: one(users, {
    fields: [quizInstancePlayers.userId],
    references: [users.userId],
  }),
}));
