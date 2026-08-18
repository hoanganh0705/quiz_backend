// =============================================================================
// Coins bounded context — relations
//
// Forward (FK-holding) relations only. The reverse side — `users` →
// `userWallet` (one) and `users` → `coinTransactions` (many) — is declared
// in `../auth/relations.ts`, mirroring how every other bounded context in
// this project wires the `users` reverse mappings.
//
// Phase 6 (S-coin-spend) adds the relations for `userFlairSlots` and
// `userQuizSuppressions` so the Drizzle query builder can `with: { ... }`
// them. The reverse side (a `users` user → many `userFlairSlots` /
// `userQuizSuppressions`) is declared in `../auth/relations.ts`.
//
// The schema migration is independent of the relations; Phase 1 only
// shipped the forward side.
// =============================================================================

import { relations } from 'drizzle-orm/relations';

import { coinTransactions, userFlairSlots, userQuizSuppressions, userWallets } from './schema';
import { users } from '../auth/schema';
import { badges, userBadges } from '../achievement/schema';
import { quizzes } from '../quiz/schema';

export const userWalletsRelations = relations(userWallets, ({ one, many }) => ({
  user: one(users, {
    fields: [userWallets.userId],
    references: [users.userId],
  }),
  transactions: many(coinTransactions),
}));

export const coinTransactionsRelations = relations(coinTransactions, ({ one }) => ({
  user: one(users, {
    fields: [coinTransactions.userId],
    references: [users.userId],
  }),
  wallet: one(userWallets, {
    fields: [coinTransactions.userId],
    references: [userWallets.userId],
  }),
}));

export const userFlairSlotsRelations = relations(userFlairSlots, ({ one }) => ({
  user: one(users, {
    fields: [userFlairSlots.userId],
    references: [users.userId],
  }),
  userBadge: one(userBadges, {
    fields: [userFlairSlots.userBadgeId],
    references: [userBadges.userBadgeId],
  }),
  badge: one(badges, {
    fields: [userFlairSlots.badgeId],
    references: [badges.badgeId],
  }),
}));

export const userQuizSuppressionsRelations = relations(userQuizSuppressions, ({ one }) => ({
  user: one(users, {
    fields: [userQuizSuppressions.userId],
    references: [users.userId],
  }),
  quiz: one(quizzes, {
    fields: [userQuizSuppressions.quizId],
    references: [quizzes.quizId],
  }),
}));
