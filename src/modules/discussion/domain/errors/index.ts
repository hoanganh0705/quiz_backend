/**
 * Discussion module — domain errors public surface.
 *
 * Re-exports the `CommentError` marker and the eleven concrete
 * subclasses from `comment.errors.ts`. The barrel is the single import
 * surface for the application, transport, and cross-module consumers.
 */

export {
  CommentError,
  CommentForbiddenError,
  CommentNotFoundError,
  DuplicateReportError,
  ModeratorRequiredError,
  ParentCommentCrossThreadError,
  ParentCommentNotFoundError,
  QuizNotFoundError,
  ReplyLimitExceededError,
  ReportNotFoundError,
  SelfReportError,
  SelfVoteError,
} from './comment.errors';
