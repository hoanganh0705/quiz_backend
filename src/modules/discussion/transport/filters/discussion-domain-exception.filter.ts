import { Catch, ArgumentsHost, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { ProblemDetail } from '@/common/types/problem-detail.type';
import { DiscussionError } from '../../domain/errors';
import { UserNotFoundError } from '@/modules/user/domain/errors';

const DISCUSSION_PROBLEM_URIS: Record<string, string> = {
  ThreadNotFoundError: 'https://api.quiz.local/problems/thread-not-found',
  CommentNotFoundError: 'https://api.quiz.local/problems/comment-not-found',
  QuizNotFoundError: 'https://api.quiz.local/problems/quiz-not-found',
  UserNotFoundError: 'https://api.quiz.local/problems/user-not-found',
  ThreadForbiddenError: 'https://api.quiz.local/problems/thread-forbidden',
  CommentForbiddenError: 'https://api.quiz.local/problems/comment-forbidden',
  ModeratorRequiredError: 'https://api.quiz.local/problems/moderator-required',
  SelfVoteError: 'https://api.quiz.local/problems/self-vote',
  SelfReportError: 'https://api.quiz.local/problems/self-report',
  ThreadClosedError: 'https://api.quiz.local/problems/thread-closed',
  ThreadNotActiveError: 'https://api.quiz.local/problems/thread-not-active',
  CommentThreadMismatchError: 'https://api.quiz.local/problems/comment-thread-mismatch',
  DuplicateReportError: 'https://api.quiz.local/problems/duplicate-report',
  DiscussionError: 'https://api.quiz.local/problems/discussion-error',
};

const STATUS_MAP: Record<string, HttpStatus> = {
  ThreadNotFoundError: HttpStatus.NOT_FOUND,
  CommentNotFoundError: HttpStatus.NOT_FOUND,
  QuizNotFoundError: HttpStatus.NOT_FOUND,
  UserNotFoundError: HttpStatus.NOT_FOUND,
  ThreadForbiddenError: HttpStatus.FORBIDDEN,
  CommentForbiddenError: HttpStatus.FORBIDDEN,
  ModeratorRequiredError: HttpStatus.FORBIDDEN,
  SelfVoteError: HttpStatus.FORBIDDEN,
  SelfReportError: HttpStatus.FORBIDDEN,
  ThreadClosedError: HttpStatus.CONFLICT,
  ThreadNotActiveError: HttpStatus.CONFLICT,
  CommentThreadMismatchError: HttpStatus.BAD_REQUEST,
  DuplicateReportError: HttpStatus.CONFLICT,
  DiscussionError: HttpStatus.BAD_REQUEST,
};

@Catch(DiscussionError, UserNotFoundError)
export class DiscussionDomainExceptionFilter {
  catch(exception: DiscussionError | UserNotFoundError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = STATUS_MAP[exception.name] ?? HttpStatus.BAD_REQUEST;
    const type = DISCUSSION_PROBLEM_URIS[exception.name] ?? DISCUSSION_PROBLEM_URIS.DiscussionError;

    const problem: ProblemDetail = {
      type,
      title: exception.name,
      status,
      detail: exception.message,
      instance: request.originalUrl ?? request.url,
    };

    response.status(status).json(problem);
  }
}
