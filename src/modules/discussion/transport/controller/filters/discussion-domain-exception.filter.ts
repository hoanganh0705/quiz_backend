import { Catch, ArgumentsHost, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import {
  DiscussionError,
  ThreadNotFoundError,
  CommentNotFoundError,
  ThreadForbiddenError,
  CommentForbiddenError,
  ThreadClosedError,
  ThreadNotActiveError,
  CommentThreadMismatchError,
  SelfVoteError,
  SelfReportError,
  DuplicateReportError,
  ReportNotFoundError,
  ReportReviewForbiddenError,
} from '../../../domain/errors';

@Catch(DiscussionError)
export class DiscussionDomainExceptionFilter {
  catch(exception: DiscussionError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.BAD_REQUEST;

    if (exception instanceof ThreadNotFoundError) {
      status = HttpStatus.NOT_FOUND;
    } else if (exception instanceof CommentNotFoundError) {
      status = HttpStatus.NOT_FOUND;
    } else if (exception instanceof ThreadForbiddenError) {
      status = HttpStatus.FORBIDDEN;
    } else if (exception instanceof CommentForbiddenError) {
      status = HttpStatus.FORBIDDEN;
    } else if (exception instanceof ThreadClosedError) {
      status = HttpStatus.CONFLICT;
    } else if (exception instanceof ThreadNotActiveError) {
      status = HttpStatus.CONFLICT;
    } else if (exception instanceof CommentThreadMismatchError) {
      status = HttpStatus.BAD_REQUEST;
    } else if (exception instanceof SelfVoteError) {
      status = HttpStatus.FORBIDDEN;
    } else if (exception instanceof SelfReportError) {
      status = HttpStatus.FORBIDDEN;
    } else if (exception instanceof DuplicateReportError) {
      status = HttpStatus.CONFLICT;
    } else if (exception instanceof ReportNotFoundError) {
      status = HttpStatus.NOT_FOUND;
    } else if (exception instanceof ReportReviewForbiddenError) {
      status = HttpStatus.FORBIDDEN;
    }

    response.status(status).json({
      statusCode: status,
      message: exception.message,
      error: exception.name,
    });
  }
}
