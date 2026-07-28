/**
 * Comment module — domain errors public surface.
 *
 * Re-exports the `CommentError` marker and the ten concrete
 * subclasses from `comment.errors.ts`. The barrel is the single import
 * surface for the application, transport, and cross-module consumers.
 *
 * Note: ParentCommentNotFoundError was removed in Phase 1 production audit
 * as it was dead code (never thrown anywhere in the codebase).
 */

export {
  CommentError,
  CommentForbiddenError,
  CommentNotFoundError,
  DuplicateReportError,
  ModeratorRequiredError,
  ParentCommentCrossThreadError,
  QuizNotFoundError,
  ReplyLimitExceededError,
  ReportNotFoundError,
  SelfReportError,
  SelfVoteError,
} from './comment.errors';
