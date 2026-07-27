// =============================================================================
// Auth bounded context — relations
//
// `usersRelations` exposes the symmetric reverse-relations of the many FKs
// that other domains declare against `users`. Because those FKs are declared
// in the FK-holding domain (e.g. quiz/relations.ts, ranking/relations.ts,
// etc.), this file only needs to declare the reverse side here. The other
// domains import `users` from this directory.
//
// `userSessionsRelations` is a self-contained one-to-many: `userSessions`
// belongs to exactly one `users` row.
// =============================================================================

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
  // Comment domain (replaces the legacy comments domain as of Phase 9.6 (post-Q&A rename))
  commentRows: many(commentRows),
  commentVotes: many(commentVotes),
  commentReports: many(commentReports),
  // Notification domain
  notifications: many(notifications),
  notificationPreferences: one(notificationPreferences),
  // Taxonomy domain
  categoryFollows: many(categoryFollows),
  tagFollows: many(tagFollows),
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
