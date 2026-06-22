// =============================================================================
// Ranking bounded context — relations
//
// Per the plan, only two ranking tables need relational-query mappings today:
// `userRanking` (with its `rankHistory` history) and `rankHistory` itself.
// `rankRecalculationWorkItems` and `rankingMilestones` are queue / audit
// tables that are not joined through the relational query API.
//
// The reverse relations for `users` (who owns which ranking row) are
// declared in `../auth/relations`.
// =============================================================================

import { relations } from 'drizzle-orm/relations';

import { rankHistory, userRanking } from './schema';
import { users } from '../auth/schema';

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
