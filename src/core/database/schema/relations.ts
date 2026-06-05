/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
import { relations } from 'drizzle-orm/relations';
import {
  badges,
  badgeRules,
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
  tagFollows,
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
  userRanking,
  rankHistory,
  userProfiles,
  userProfileSettings,
  userActivityEvents,
  friendships,
  blockedUsers,
  userFollows,
  discussionThreads,
  discussionComments,
  discussionVotes,
  discussionReports,
  oauthAccounts,
  categoryFollows,
} from '.';

export const userRankingRelations = relations(userRanking, ({ one, many }) => ({
  user: one(users, {
    fields: [userRanking.userId],
    references: [users.userId],
  }),
  rankHistories: many(rankHistory),
}));

export const rankHistoryRelations = relations(rankHistory, ({ one }) => ({
  user: one(users, {
    fields: [rankHistory.userId],
    references: [users.userId],
  }),
}));

export const badgesRelations = relations(badges, ({ many }) => ({
  userBadges: many(userBadges),
  badgeRules: many(badgeRules),
}));

export const badgeRulesRelations = relations(badgeRules, ({ one }) => ({
  badge: one(badges, {
    fields: [badgeRules.badgeId],
    references: [badges.badgeId],
  }),
}));

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

export const usersRelations = relations(users, ({ many, one }) => ({
  userBadges: many(userBadges),
  userRanking: one(userRanking),
  rankHistories: many(rankHistory),
  quizzes: many(quizzes),
  quizVersions: many(quizVersions),
  quizAttempts: many(quizAttempts),
  quizReviews: many(quizReviews),
  bookmarkCollections: many(bookmarkCollections),
  quizInstances: many(quizInstances),
  quizInstancePlayers: many(quizInstancePlayers),
  tournamentParticipants: many(tournamentParticipants),
  userSessions: many(userSessions),
  userProfile: one(userProfiles),
  userProfileSettings: one(userProfileSettings),
  activityEvents: many(userActivityEvents),
  // Social relations
  sentFriendRequests: many(friendships, { relationName: 'friendshipRequester' }),
  receivedFriendRequests: many(friendships, { relationName: 'friendshipAddressee' }),
  blockedUsers: many(blockedUsers, { relationName: 'blocker' }),
  blockedByUsers: many(blockedUsers, { relationName: 'blocked' }),
  followers: many(userFollows, { relationName: 'follower' }),
  following: many(userFollows, { relationName: 'following' }),
  // Discussion relations
  discussionThreads: many(discussionThreads),
  discussionComments: many(discussionComments),
  discussionVotes: many(discussionVotes),
  discussionReports: many(discussionReports),
  // Category relations
  categoryFollows: many(categoryFollows),
  // Tag relations
  tagFollows: many(tagFollows),
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
  categoryFollows: many(categoryFollows),
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
  tagFollows: many(tagFollows),
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

export const userProfilesRelations = relations(userProfiles, ({ one }) => ({
  user: one(users, {
    fields: [userProfiles.userId],
    references: [users.userId],
  }),
}));

export const userProfileSettingsRelations = relations(userProfileSettings, ({ one }) => ({
  user: one(users, {
    fields: [userProfileSettings.userId],
    references: [users.userId],
  }),
}));

export const userActivityEventsRelations = relations(userActivityEvents, ({ one }) => ({
  user: one(users, {
    fields: [userActivityEvents.userId],
    references: [users.userId],
  }),
}));

// Social Domain Relations

export const friendshipsRelations = relations(friendships, ({ one }) => ({
  requester: one(users, {
    fields: [friendships.requesterId],
    references: [users.userId],
    relationName: 'friendshipRequester',
  }),
  addressee: one(users, {
    fields: [friendships.addresseeId],
    references: [users.userId],
    relationName: 'friendshipAddressee',
  }),
}));

export const blockedUsersRelations = relations(blockedUsers, ({ one }) => ({
  blocker: one(users, {
    fields: [blockedUsers.blockerId],
    references: [users.userId],
    relationName: 'blocker',
  }),
  blocked: one(users, {
    fields: [blockedUsers.blockedId],
    references: [users.userId],
    relationName: 'blocked',
  }),
}));

export const userFollowsRelations = relations(userFollows, ({ one }) => ({
  follower: one(users, {
    fields: [userFollows.followerId],
    references: [users.userId],
    relationName: 'follower',
  }),
  following: one(users, {
    fields: [userFollows.followingId],
    references: [users.userId],
    relationName: 'following',
  }),
}));

// Discussion Domain Relations

export const discussionThreadsRelations = relations(discussionThreads, ({ one, many }) => ({
  quiz: one(quizzes, {
    fields: [discussionThreads.quizId],
    references: [quizzes.quizId],
  }),
  author: one(users, {
    fields: [discussionThreads.authorId],
    references: [users.userId],
  }),
  comments: many(discussionComments),
  votes: many(discussionVotes),
  reports: many(discussionReports),
}));

export const discussionCommentsRelations = relations(discussionComments, ({ one, many }) => ({
  thread: one(discussionThreads, {
    fields: [discussionComments.threadId],
    references: [discussionThreads.threadId],
  }),
  author: one(users, {
    fields: [discussionComments.authorId],
    references: [users.userId],
  }),
  parentComment: one(discussionComments, {
    fields: [discussionComments.parentCommentId],
    references: [discussionComments.commentId],
    relationName: 'discussionCommentParent',
  }),
  replies: many(discussionComments, {
    relationName: 'discussionCommentParent',
  }),
  votes: many(discussionVotes),
  reports: many(discussionReports),
}));

export const discussionVotesRelations = relations(discussionVotes, ({ one }) => ({
  user: one(users, {
    fields: [discussionVotes.userId],
    references: [users.userId],
  }),
}));

export const discussionReportsRelations = relations(discussionReports, ({ one }) => ({
  reporter: one(users, {
    fields: [discussionReports.reporterId],
    references: [users.userId],
    relationName: 'discussionReportReporter',
  }),
  reviewedBy: one(users, {
    fields: [discussionReports.reviewedByUserId],
    references: [users.userId],
    relationName: 'discussionReportReviewer',
  }),
}));

export const oauthAccountsRelations = relations(oauthAccounts, ({ one }) => ({
  user: one(users, {
    fields: [oauthAccounts.userId],
    references: [users.userId],
  }),
}));

// Category Follows Relations

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
