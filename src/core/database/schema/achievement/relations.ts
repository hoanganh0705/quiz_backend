// =============================================================================
// Achievement bounded context — relations
//
// The three achievement tables form a tight cluster: `badges` is the catalog,
// `badgeRules` configures per-badge conditions, and `userBadges` is the
// per-user ledger. The reverse relation for `users` (who owns which badges)
// is declared in `../auth/relations`.
//
// Cross-domain imports
//   - users (auth) — userBadges.userId
// =============================================================================

import { relations } from 'drizzle-orm/relations';

import { badges, badgeRules, userBadges } from './schema';
import { users } from '../auth/schema';

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
