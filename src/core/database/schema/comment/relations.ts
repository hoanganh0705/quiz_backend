// =============================================================================
// Comment bounded context — relations
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
  discussionCommentVotes,
  discussionCommentReports,
} from './schema';
import { users } from '../auth/schema';

export const discussionCommentsRelations = relations(discussionComments, ({ one, many }) => ({
  author: one(users, {
    fields: [discussionComments.authorId],
    references: [users.userId],
  }),
  hiddenBy: one(users, {
    fields: [discussionComments.hiddenById],
    references: [users.userId],
    relationName: 'discussionCommentHiddenBy',
  }),
  parentComment: one(discussionComments, {
    fields: [discussionComments.parentCommentId],
    references: [discussionComments.commentId],
    relationName: 'discussionCommentParent',
  }),
  replies: many(discussionComments, {
    relationName: 'discussionCommentParent',
  }),
  votes: many(discussionCommentVotes),
  reports: many(discussionCommentReports),
}));

export const discussionCommentVotesRelations = relations(discussionCommentVotes, ({ one }) => ({
  user: one(users, {
    fields: [discussionCommentVotes.userId],
    references: [users.userId],
  }),
  comment: one(discussionComments, {
    fields: [discussionCommentVotes.commentId],
    references: [discussionComments.commentId],
  }),
}));

export const discussionCommentReportsRelations = relations(
  discussionCommentReports,
  ({ one }) => ({
    reporter: one(users, {
      fields: [discussionCommentReports.reporterId],
      references: [users.userId],
      relationName: 'discussionCommentReportReporter',
    }),
    reviewedBy: one(users, {
      fields: [discussionCommentReports.reviewedByUserId],
      references: [users.userId],
      relationName: 'discussionCommentReportReviewer',
    }),
    comment: one(discussionComments, {
      fields: [discussionCommentReports.commentId],
      references: [discussionComments.commentId],
    }),
  }),
);