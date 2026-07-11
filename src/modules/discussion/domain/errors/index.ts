import { BaseDomainException } from '@/common/errors/base-domain.exception';

/**
 * Discussion-module namespace marker for discussion-domain exceptions.
 *
 * Per the RFC 7807 migration plan (§7.1), intermediate abstract layers are
 * removed — but a module-namespace marker is a legitimate use of an
 * intermediate class. (Today no dispatch on this class happens at the
 * global-filter level; the filter resolves each concrete exception's
 * `code` via `ProblemCodeMapping` instead. The intermediate stays as a
 * domain-side marker for symmetry with the auth, quiz, attempt, user,
 * category, tag, tournament, review, bookmark, instance, social, and
 * achievement modules.)
 *
 * Abstract — does not declare a `code` — because no concrete exception
 * needs a generic `code` for an unmapped operation failure. Audit:
 * `grep -rn 'new DiscussionError' src/` returns no matches.
 *
 * Phase 3.1 specific note (rev4.8): the prior per-module filter
 * `DiscussionDomainExceptionFilter` used `exception.name` as a
 * lookup key into `STATUS_MAP` and `DISCUSSION_PROBLEM_URIS`. After
 * Phase 3.1 the lookup tables are replaced with `ProblemCodeMapping`
 * entries keyed by `code`. The `title` field used to be
 * `exception.name` (e.g. `'ThreadNotFoundError'`); it is now the
 * standard RFC 7807 title (e.g. `'NotFound'`). This is a wire-shape
 * change — clients that switch on `title` must migrate to standard
 * problem titles.
 */
export abstract class DiscussionError extends BaseDomainException {}

/**
 * Thrown when a discussion thread cannot be found. 404 Not Found.
 *
 * Wire-shape improvement: the prior per-module filter preserved
 * the thrown message verbatim; behavior is unchanged. `title` changes
 * from the class name `'ThreadNotFoundError'` to the standard
 * RFC 7807 title `'NotFound'` (a Phase 3.1 deliverable per §8.4.1).
 */
export class ThreadNotFoundError extends DiscussionError {
  readonly code = 'DISCUSSION_THREAD_NOT_FOUND';
  constructor(threadId: string) {
    super(`Thread not found: ${threadId}`);
  }
}

/**
 * Thrown when a discussion comment cannot be found. 404 Not Found.
 *
 * Wire-shape improvement: the prior per-module filter preserved
 * the thrown message verbatim; behavior is unchanged. `title` changes
 * from the class name `'CommentNotFoundError'` to the standard
 * RFC 7807 title `'NotFound'`.
 */
export class CommentNotFoundError extends DiscussionError {
  readonly code = 'DISCUSSION_COMMENT_NOT_FOUND';
  constructor(commentId: string) {
    super(`Comment not found: ${commentId}`);
  }
}

/**
 * Thrown when the authenticated user lacks permission to perform an
 * action on a thread. 403 Forbidden.
 */
export class ThreadForbiddenError extends DiscussionError {
  readonly code = 'DISCUSSION_THREAD_FORBIDDEN';
  constructor() {
    super('You do not have permission to perform this action on this thread');
  }
}

/**
 * Thrown when the authenticated user lacks permission to perform an
 * action on a comment. 403 Forbidden.
 */
export class CommentForbiddenError extends DiscussionError {
  readonly code = 'DISCUSSION_COMMENT_FORBIDDEN';
  constructor() {
    super('You do not have permission to perform this action on this comment');
  }
}

/**
 * Thrown when an attempt is made to modify a closed thread. 409
 * Conflict.
 */
export class ThreadClosedError extends DiscussionError {
  readonly code = 'DISCUSSION_THREAD_CLOSED';
  constructor() {
    super('This thread is closed and cannot accept new comments');
  }
}

/**
 * Thrown when an attempt is made to modify a thread whose status is
 * not `'active'` (e.g. `'deleted'`). 409 Conflict.
 */
export class ThreadNotActiveError extends DiscussionError {
  readonly code = 'DISCUSSION_THREAD_NOT_ACTIVE';
  constructor() {
    super('This thread is not active and cannot be modified');
  }
}

/**
 * Thrown when a parent comment does not belong to the thread the
 * caller is replying to. 400 Bad Request.
 *
 * Plan §8.4.1 risk note: this class's 400 status is non-obvious
 * from the class name (one might expect 409 Conflict for a
 * cross-resource mismatch); the migration test captures it.
 */
export class CommentThreadMismatchError extends DiscussionError {
  readonly code = 'DISCUSSION_COMMENT_THREAD_MISMATCH';
  constructor() {
    super('The selected comment does not belong to this thread');
  }
}

/**
 * Thrown when the user attempts to vote on their own content. 403
 * Forbidden.
 */
export class SelfVoteError extends DiscussionError {
  readonly code = 'DISCUSSION_SELF_VOTE';
  constructor() {
    super('You cannot vote on your own content');
  }
}

/**
 * Thrown when the user attempts to report their own content. 403
 * Forbidden.
 */
export class SelfReportError extends DiscussionError {
  readonly code = 'DISCUSSION_SELF_REPORT';
  constructor() {
    super('You cannot report your own content');
  }
}

/**
 * Thrown when the user attempts to report content that they have
 * already reported. 409 Conflict.
 */
export class DuplicateReportError extends DiscussionError {
  readonly code = 'DISCUSSION_DUPLICATE_REPORT';
  constructor() {
    super('You have already reported this content');
  }
}

/**
 * Thrown when the discussion module's `QuizNotFoundError` fires
 * (quiz lookup during a discussion operation). 404 Not Found.
 *
 * This is the **discussion-module** version of the class; the
 * quiz-module version uses `QUIZ_NOT_FOUND` and the quiz-analytics
 * version uses `QUIZ_ANALYTICS_NOT_FOUND`. They share the
 * JavaScript class name but are distinct at runtime. Clients
 * should switch on `extensions.code`, never on the class name.
 * The §9 item-1 unification (merge these into a single class) is
 * deferred.
 */
export class QuizNotFoundError extends DiscussionError {
  readonly code = 'DISCUSSION_QUIZ_NOT_FOUND';
  constructor(quizId: string) {
    super(`Quiz not found: ${quizId}`);
  }
}

/**
 * Thrown when a moderator-only action is attempted by a non-
 * moderator user. 403 Forbidden.
 *
 * Plan §8.4.1 risk note: this class's 403 status is non-obvious
 * from the class name; the migration test captures it.
 */
export class ModeratorRequiredError extends DiscussionError {
  readonly code = 'DISCUSSION_MODERATOR_REQUIRED';
  constructor() {
    super('Moderator or admin role is required to perform this action');
  }
}
