// =============================================================================
// Discussion bounded context — relations
//
// Each `relations()` callback uses lazy evaluation: the callback is
// stored as a function and only invoked when Drizzle resolves the
// relational query API. This means cross-domain table references
// (via live bindings from `..` or from extracted sibling domains) are
// safe — the values will be resolved by the time the callback runs.
// =============================================================================

import { relations } from 'drizzle-orm/relations';

import {
  discussionComments,
  discussionReports,
  discussionSavedThreads,
  discussionThreadSubscriptions,
  discussionThreads,
  discussionVotes,
} from './schema';
import { users } from '../auth/schema';
import { quizzes } from '../quiz/schema';

export const discussionThreadsRelations = relations(discussionThreads, ({ one, many }) => ({
  quiz: one(quizzes, {
    fields: [discussionThreads.quizId],
    references: [quizzes.quizId],
  }),
  author: one(users, {
    fields: [discussionThreads.authorId],
    references: [users.userId],
  }),
  solvedComment: one(discussionComments, {
    fields: [discussionThreads.solvedCommentId],
    references: [discussionComments.commentId],
    relationName: 'discussionThreadSolvedComment',
  }),
  solver: one(users, {
    fields: [discussionThreads.solvedBy],
    references: [users.userId],
    relationName: 'discussionThreadSolver',
  }),
  comments: many(discussionComments),
  votes: many(discussionVotes),
  reports: many(discussionReports),
  subscriptions: many(discussionThreadSubscriptions),
  savedThreads: many(discussionSavedThreads),
}));

export const discussionCommentsRelations = relations(discussionComments, ({ one, many }) => ({
  thread: one(discussionThreads, {
    fields: [discussionComments.threadId],
    references: [discussionThreads.threadId],
  }),
  author: one(users, {
    fields: [discussionComments.authorId],
    references: [users.userId],
  }),
  parentComment: one(discussionComments, {
    fields: [discussionComments.parentCommentId],
    references: [discussionComments.commentId],
    relationName: 'discussionCommentParent',
  }),
  replies: many(discussionComments, {
    relationName: 'discussionCommentParent',
  }),
  solvedForThreads: many(discussionThreads, {
    relationName: 'discussionThreadSolvedComment',
  }),
  votes: many(discussionVotes),
  reports: many(discussionReports),
}));

export const discussionVotesRelations = relations(discussionVotes, ({ one }) => ({
  user: one(users, {
    fields: [discussionVotes.userId],
    references: [users.userId],
  }),
}));

export const discussionReportsRelations = relations(discussionReports, ({ one }) => ({
  reporter: one(users, {
    fields: [discussionReports.reporterId],
    references: [users.userId],
    relationName: 'discussionReportReporter',
  }),
  reviewedBy: one(users, {
    fields: [discussionReports.reviewedByUserId],
    references: [users.userId],
    relationName: 'discussionReportReviewer',
  }),
}));

export const discussionThreadSubscriptionsRelations = relations(
  discussionThreadSubscriptions,
  ({ one }) => ({
    user: one(users, {
      fields: [discussionThreadSubscriptions.userId],
      references: [users.userId],
    }),
    thread: one(discussionThreads, {
      fields: [discussionThreadSubscriptions.threadId],
      references: [discussionThreads.threadId],
    }),
  }),
);

export const discussionSavedThreadsRelations = relations(discussionSavedThreads, ({ one }) => ({
  user: one(users, {
    fields: [discussionSavedThreads.userId],
    references: [users.userId],
  }),
  thread: one(discussionThreads, {
    fields: [discussionSavedThreads.threadId],
    references: [discussionThreads.threadId],
  }),
}));
