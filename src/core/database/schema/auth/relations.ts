import { relations } from 'drizzle-orm/relations';

import { users, userSessions, oauthAccounts } from './schema';
import {
  userBadges,
  userRanking,
  rankHistory,
  quizzes,
  quizVersions,
  quizAttempts,
  quizReviews,
  bookmarkCollections,
  quizInstances,
  quizInstancePlayers,
  tournamentParticipants,
  userProfiles,
  userProfileSettings,
  userActivityEvents,
  socialFeedActivities,
  friendships,
  blockedUsers,
  userFollows,
  commentRows,
  commentVotes,
  commentReports,
  notifications,
  notificationPreferences,
  categoryFollows,
  tagFollows,
  userWallets,
  coinTransactions,
  userFlairSlots,
  userQuizSuppressions,
} from '..';

export const usersRelations = relations(users, ({ many, one }) => ({
  // Achievement domain
  userBadges: many(userBadges),
  // Ranking domain
  userRanking: one(userRanking),
  rankHistories: many(rankHistory),
  // Quiz domain
  quizzes: many(quizzes),
  quizVersions: many(quizVersions),
  quizAttempts: many(quizAttempts),
  quizReviews: many(quizReviews),
  bookmarkCollections: many(bookmarkCollections),
  quizInstances: many(quizInstances),
  quizInstancePlayers: many(quizInstancePlayers),
  // Tournament domain
  tournamentParticipants: many(tournamentParticipants),
  // Auth domain (self)
  userSessions: many(userSessions),
  oauthAccounts: many(oauthAccounts),
  // User domain
  userProfile: one(userProfiles),
  userProfileSettings: one(userProfileSettings),
  activityEvents: many(userActivityEvents),
  // Social domain
  socialFeedActivities: many(socialFeedActivities),
  sentFriendRequests: many(friendships, { relationName: 'friendshipRequester' }),
  receivedFriendRequests: many(friendships, { relationName: 'friendshipAddressee' }),
  blockedUsers: many(blockedUsers, { relationName: 'blocker' }),
  blockedByUsers: many(blockedUsers, { relationName: 'blocked' }),
  followers: many(userFollows, { relationName: 'follower' }),
  following: many(userFollows, { relationName: 'following' }),
  commentRows: many(commentRows),
  commentVotes: many(commentVotes),
  commentReports: many(commentReports),
  // Notification domain
  notifications: many(notifications),
  notificationPreferences: one(notificationPreferences),
  // Taxonomy domain
  categoryFollows: many(categoryFollows),
  tagFollows: many(tagFollows),
  userWallet: one(userWallets),
  coinTransactions: many(coinTransactions),
  userFlairSlots: many(userFlairSlots),
  userQuizSuppressions: many(userQuizSuppressions),
}));

export const userSessionsRelations = relations(userSessions, ({ one }) => ({
  user: one(users, {
    fields: [userSessions.userId],
    references: [users.userId],
  }),
}));

export const oauthAccountsRelations = relations(oauthAccounts, ({ one }) => ({
  user: one(users, {
    fields: [oauthAccounts.userId],
    references: [users.userId],
  }),
}));
