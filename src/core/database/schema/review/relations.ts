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
