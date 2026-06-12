export class DiscussionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DiscussionError';
  }
}

export class ThreadNotFoundError extends DiscussionError {
  constructor(threadId: string) {
    super(`Thread not found: ${threadId}`);
    this.name = 'ThreadNotFoundError';
  }
}

export class CommentNotFoundError extends DiscussionError {
  constructor(commentId: string) {
    super(`Comment not found: ${commentId}`);
    this.name = 'CommentNotFoundError';
  }
}

export class ThreadForbiddenError extends DiscussionError {
  constructor() {
    super('You do not have permission to perform this action on this thread');
    this.name = 'ThreadForbiddenError';
  }
}

export class CommentForbiddenError extends DiscussionError {
  constructor() {
    super('You do not have permission to perform this action on this comment');
    this.name = 'CommentForbiddenError';
  }
}

export class ThreadClosedError extends DiscussionError {
  constructor() {
    super('This thread is closed and cannot accept new comments');
    this.name = 'ThreadClosedError';
  }
}

export class ThreadNotActiveError extends DiscussionError {
  constructor() {
    super('This thread is not active and cannot be modified');
    this.name = 'ThreadNotActiveError';
  }
}

export class CommentThreadMismatchError extends DiscussionError {
  constructor() {
    super('The selected comment does not belong to this thread');
    this.name = 'CommentThreadMismatchError';
  }
}

export class SelfVoteError extends DiscussionError {
  constructor() {
    super('You cannot vote on your own content');
    this.name = 'SelfVoteError';
  }
}

export class SelfReportError extends DiscussionError {
  constructor() {
    super('You cannot report your own content');
    this.name = 'SelfReportError';
  }
}

export class DuplicateReportError extends DiscussionError {
  constructor() {
    super('You have already reported this content');
    this.name = 'DuplicateReportError';
  }
}

export class QuizNotFoundError extends DiscussionError {
  constructor(quizId: string) {
    super(`Quiz not found: ${quizId}`);
    this.name = 'QuizNotFoundError';
  }
}

export class ModeratorRequiredError extends DiscussionError {
  constructor() {
    super('Moderator or admin role is required to perform this action');
    this.name = 'ModeratorRequiredError';
  }
}
