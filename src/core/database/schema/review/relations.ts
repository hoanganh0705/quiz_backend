// =============================================================================
// Review bounded context — relations
//
// The review tables (reviewHelpfulVotes, reviewReports) are co-located with
// the quiz domain in Phase 3 of the refactoring plan — they live in
// `../quiz/schema`. The reverse relations for `users` (who voted/reported)
// are also declared in `../auth/relations`, since `users` is the central
// identity hub. This file only declares the relations rooted at the two
// review tables themselves.
// =============================================================================

import { relations } from 'drizzle-orm/relations';

import { reviewHelpfulVotes, reviewReports } from '../quiz/schema';
import { users } from '../auth/schema';
import { quizReviews } from '../quiz/schema';

export const reviewHelpfulVotesRelations = relations(reviewHelpfulVotes, ({ one }) => ({
  review: one(quizReviews, {
    fields: [reviewHelpfulVotes.reviewId],
    references: [quizReviews.reviewId],
  }),
  user: one(users, {
    fields: [reviewHelpfulVotes.userId],
    references: [users.userId],
  }),
}));

export const reviewReportsRelations = relations(reviewReports, ({ one }) => ({
  review: one(quizReviews, {
    fields: [reviewReports.reviewId],
    references: [quizReviews.reviewId],
  }),
  reporter: one(users, {
    fields: [reviewReports.reporterId],
    references: [users.userId],
  }),
}));
