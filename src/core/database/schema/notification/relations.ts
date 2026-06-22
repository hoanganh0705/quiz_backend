/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
import { relations } from 'drizzle-orm/relations';
import { notifications, notificationPreferences } from './schema';
import { users } from '../auth/schema';

// =============================================================================
// Notification Domain Relations
//
// Relations for: notifications, notificationPreferences
// =============================================================================

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.userId],
  }),
}));

export const notificationPreferencesRelations = relations(notificationPreferences, ({ one }) => ({
  user: one(users, {
    fields: [notificationPreferences.userId],
    references: [users.userId],
  }),
}));
