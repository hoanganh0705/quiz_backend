import { relations } from 'drizzle-orm';
import { commentRows, commentVotes, commentReports } from './schema';

// =============================================================================
// Comment domain — relations
//
// `commentRowsRelations` declares the parent/reply tree on the comment table
// itself (self-referential FK on `comments.parent_comment_id`) plus the
// relations to votes and reports tables.
//
// The reverse relations (author → comments, hiddenBy → comments, reporter →
// reports, reviewer → reports) are declared in auth/relations.ts via
// `usersRelations` so that auth does not import from the comment domain.
// =============================================================================

export const commentRowsRelations = relations(commentRows, ({ one, many }) => ({
  // Author and moderator (hiddenBy) are declared in auth/relations.ts as
  // reverse relations; Drizzle infers them from the column names.

  // Self-referential parent/reply tree.
  parentComment: one(commentRows, {
    fields: [commentRows.parentCommentId],
    references: [commentRows.commentId],
    relationName: 'commentParent',
  }),
  replies: many(commentRows, {
    relationName: 'commentParent',
  }),

  votes: many(commentVotes),
  reports: many(commentReports),
}));

export const commentVotesRelations = relations(commentVotes, ({ one }) => ({
  // Voter is declared in auth/relations.ts as a reverse relation.
  comment: one(commentRows, {
    fields: [commentVotes.commentId],
    references: [commentRows.commentId],
    relationName: 'comment',
  }),
}));

export const commentReportsRelations = relations(commentReports, ({ one }) => ({
  // Reporter and reviewer are declared in auth/relations.ts as reverse relations.
  comment: one(commentRows, {
    fields: [commentReports.commentId],
    references: [commentRows.commentId],
    relationName: 'comment',
  }),
}));
