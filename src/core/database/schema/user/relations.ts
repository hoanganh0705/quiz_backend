// =============================================================================
// User bounded context — relations
//
// All three user-domain tables have a single relation: the `user` they
// belong to. The reverse relations for `users` (what profile, settings,
// and activity events exist for a given user) are declared in
// `../auth/relations`.
// =============================================================================

import { relations } from 'drizzle-orm/relations';

import { userActivityEvents, userProfiles, userProfileSettings } from './schema';
import { users } from '../auth/schema';

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
