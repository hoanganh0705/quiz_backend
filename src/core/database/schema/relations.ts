/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
import { relations } from 'drizzle-orm/relations';
import {
  badges,
  userBadges,
  users,
  userSessions,
  quizzes,
  quizVersions,
  quizQuestions,
  quizAnswerOptions,
  categories,
  quizCategories,
  quizTags,
  tags,
  quizStats,
  quizAttempts,
  quizAttemptAnswers,
  quizAttemptEvents,
  quizReviews,
  bookmarkCollections,
  bookmarkedQuizzes,
  quizInstances,
  quizInstancePlayers,
  tournamentRounds,
  tournaments,
  tournamentParticipants,
  tournamentRoundParticipants,
} from '.';

export const userBadgesRelations = relations(userBadges, ({ one }) => ({
  badge: one(badges, {
    fields: [userBadges.badgeId],
    references: [badges.badgeId],
  }),
  user: one(users, {
    fields: [userBadges.userId],
    references: [users.userId],
  }),
}));

export const badgesRelations = relations(badges, ({ many }) => ({
  userBadges: many(userBadges),
}));

export const usersRelations = relations(users, ({ many }) => ({
  userBadges: many(userBadges),
  quizzes: many(quizzes),
  quizVersions: many(quizVersions),
  quizAttempts: many(quizAttempts),
  quizReviews: many(quizReviews),
  bookmarkCollections: many(bookmarkCollections),
  quizInstances: many(quizInstances),
  quizInstancePlayers: many(quizInstancePlayers),
  tournamentParticipants: many(tournamentParticipants),
  userSessions: many(userSessions), // thêm dòng này
}));

export const userSessionsRelations = relations(userSessions, ({ one }) => ({
  user: one(users, {
    fields: [userSessions.userId],
    references: [users.userId],
  }),
}));

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
  quizStats: many(quizStats),
  quizReviews: many(quizReviews),
  bookmarkedQuizzes: many(bookmarkedQuizzes),
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
  tournamentRounds: many(tournamentRounds),
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
  category: one(categories, {
    fields: [quizCategories.categoryId],
    references: [categories.categoryId],
  }),
  quiz: one(quizzes, {
    fields: [quizCategories.quizId],
    references: [quizzes.quizId],
  }),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  quizCategories: many(quizCategories),
  tournaments: many(tournaments),
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

export const tagsRelations = relations(tags, ({ many }) => ({
  quizTags: many(quizTags),
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
  tournamentRoundParticipants: many(tournamentRoundParticipants),
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

export const tournamentRoundsRelations = relations(tournamentRounds, ({ one, many }) => ({
  quizVersion: one(quizVersions, {
    fields: [tournamentRounds.quizVersionId],
    references: [quizVersions.quizVersionId],
  }),
  tournament: one(tournaments, {
    fields: [tournamentRounds.tournamentId],
    references: [tournaments.tournamentId],
  }),
  tournamentRoundParticipants: many(tournamentRoundParticipants),
}));

export const tournamentsRelations = relations(tournaments, ({ one, many }) => ({
  tournamentRounds: many(tournamentRounds),
  category: one(categories, {
    fields: [tournaments.categoryId],
    references: [categories.categoryId],
  }),
  tournamentParticipants: many(tournamentParticipants),
}));

export const tournamentParticipantsRelations = relations(
  tournamentParticipants,
  ({ one, many }) => ({
    tournament: one(tournaments, {
      fields: [tournamentParticipants.tournamentId],
      references: [tournaments.tournamentId],
    }),
    user: one(users, {
      fields: [tournamentParticipants.userId],
      references: [users.userId],
    }),
    tournamentRoundParticipants: many(tournamentRoundParticipants),
  }),
);

export const tournamentRoundParticipantsRelations = relations(
  tournamentRoundParticipants,
  ({ one }) => ({
    quizAttempt: one(quizAttempts, {
      fields: [tournamentRoundParticipants.attemptId],
      references: [quizAttempts.attemptId],
    }),
    tournamentParticipant: one(tournamentParticipants, {
      fields: [tournamentRoundParticipants.participantId],
      references: [tournamentParticipants.participantId],
    }),
    tournamentRound: one(tournamentRounds, {
      fields: [tournamentRoundParticipants.roundId],
      references: [tournamentRounds.roundId],
    }),
  }),
);
