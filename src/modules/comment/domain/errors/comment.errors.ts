import { BaseDomainException } from '@/common/errors/base-domain.exception';

/**
 * Comment-module namespace marker for comment-domain exceptions.
 *
 * Mirrors the pattern used in every other module (auth, quiz, attempt,
 * user, category, tag, tournament, review, bookmark, instance, social,
 * achievement, ranking, notification): a domain-side marker class with
 * no `code`, so the global filter dispatches on each concrete class's
 * own `code` field instead.
 *
 * Abstract — does not declare a `code` — because no concrete exception
 * needs a generic `code` for an unmapped operation failure. Audit:
 * `grep -rn 'new CommentError' src/` returns no matches.
 */
export abstract class CommentError extends BaseDomainException {}

/**
 * Thrown when a comment cannot be found by id, or when the comment has
 * been soft-deleted (tombstoned). 404 Not Found.
 *
 * Also thrown when a reply's parent comment has been hidden, deleted, or
 * otherwise no longer accepts replies — the parent is "not found" from
 * the perspective of a new reply.
 */
export class CommentNotFoundError extends CommentError {
  readonly code = 'COMMENT_NOT_FOUND';
  constructor(commentId: string) {
    super(`Comment not found: ${commentId}`);
  }
}

/**
 * Thrown when the authenticated user lacks permission to perform an
 * action on a comment. 403 Forbidden.
 *
 * The actor is not the comment author and not a moderator.
 */
export class CommentForbiddenError extends CommentError {
  readonly code = 'COMMENT_FORBIDDEN';
  constructor() {
    super('You do not have permission to perform this action on this comment');
  }
}

/**
 * Thrown when the comment module's `QuizNotFoundError` fires (quiz
 * lookup during a comment operation). 404 Not Found.
 *
 * This is the **comment-module** version of the class; the
 * quiz-module version uses `QUIZ_NOT_FOUND` and the quiz-analytics
 * version uses `QUIZ_ANALYTICS_NOT_FOUND`. They share the JavaScript
 * class name but are distinct at runtime. Clients should switch on
 * `extensions.code`, never on the class name. The §9 item-1
 * unification (merge these into a single class) is deferred.
 */
export class QuizNotFoundError extends CommentError {
  readonly code = 'COMMENT_QUIZ_NOT_FOUND';
  constructor(quizId: string) {
    super(`Quiz not found: ${quizId}`);
  }
}

/**
 * Thrown when a reply references a parent comment that does not exist
 * or has been hidden / soft-deleted. 404 Not Found.
 *
 * Distinct from `CommentNotFoundError`: this is the *parent* lookup
 * that fails before the reply itself can be created. The wire shape is
 * identical (404) but the `code` is unique so clients dispatching on
 * `extensions.code` can give a precise error message.
 */
export class ParentCommentNotFoundError extends CommentError {
  readonly code = 'COMMENT_PARENT_COMMENT_NOT_FOUND';
  constructor(parentCommentId: string) {
    super(`Parent comment not found: ${parentCommentId}`);
  }
}

/**
 * Thrown when a reply's parent comment lives on a different quiz than
 * the one the reply is being posted under, or when the parent comment
 * is itself a reply (violating the two-level rule). 400 Bad Request.
 *
 * Plan §8.4.1 risk note: this class's 400 status is non-obvious from
 * the class name (one might expect 409 Conflict for a cross-resource
 * mismatch); the migration test captures it.
 */
export class ParentCommentCrossThreadError extends CommentError {
  readonly code = 'COMMENT_PARENT_COMMENT_CROSS_THREAD';
  constructor() {
    super('The selected parent comment is not a top-level comment on this quiz');
  }
}

/**
 * Thrown when a reply is attempted against a comment that has already
 * reached the maximum reply limit (100 replies). 409 Conflict.
 */
export class ReplyLimitExceededError extends CommentError {
  readonly code = 'COMMENT_REPLY_LIMIT_EXCEEDED';
  constructor(maxReplies: number) {
    super(`Maximum reply limit of ${maxReplies} reached for this comment`);
  }
}

/**
 * Thrown when the user attempts to vote on their own comment. 403
 * Forbidden.
 */
export class SelfVoteError extends CommentError {
  readonly code = 'COMMENT_SELF_VOTE';
  constructor() {
    super('You cannot vote on your own comment');
  }
}

/**
 * Thrown when the user attempts to report their own comment. 403
 * Forbidden.
 */
export class SelfReportError extends CommentError {
  readonly code = 'COMMENT_SELF_REPORT';
  constructor() {
    super('You cannot report your own comment');
  }
}

/**
 * Thrown when the user attempts to report a comment that they have
 * already reported and the prior report is still `'open'`. 409 Conflict.
 */
export class DuplicateReportError extends CommentError {
  readonly code = 'COMMENT_DUPLICATE_REPORT';
  constructor() {
    super('You have already reported this comment');
  }
}

/**
 * Thrown when a moderator tries to review a report that does not
 * exist. 404 Not Found.
 */
export class ReportNotFoundError extends CommentError {
  readonly code = 'COMMENT_REPORT_NOT_FOUND';
  constructor(reportId: string) {
    super(`Report not found: ${reportId}`);
  }
}

/**
 * Thrown when a moderator-only action is attempted by a non-moderator
 * user. 403 Forbidden.
 *
 * Plan §8.4.1 risk note: this class's 403 status is non-obvious from
 * the class name; the migration test captures it.
 */
export class ModeratorRequiredError extends CommentError {
  readonly code = 'COMMENT_MODERATOR_REQUIRED';
  constructor() {
    super('Moderator or admin role is required to perform this action');
  }
}
