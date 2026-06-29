import { relations } from 'drizzle-orm/relations';
import { socialFeedActivities, friendships, blockedUsers, userFollows } from './schema';
import { users } from '../auth/schema';

// =============================================================================
// Social Domain Relations
//
// Relations for: socialFeedActivities, friendships, blockedUsers, userFollows
// =============================================================================

export const socialFeedActivitiesRelations = relations(socialFeedActivities, ({ one }) => ({
  user: one(users, {
    fields: [socialFeedActivities.userId],
    references: [users.userId],
  }),
}));

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
