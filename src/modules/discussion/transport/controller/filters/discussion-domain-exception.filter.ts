import { Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import {
  DiscussionError,
  ThreadNotFoundError,
  CommentNotFoundError,
  ThreadForbiddenError,
  CommentForbiddenError,
  ThreadClosedError,
  ThreadNotActiveError,
  DuplicateVoteError,
  SelfVoteError,
  SelfReportError,
  DuplicateReportError,
} from '../../../../domain/errors';

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
    } else if (exception instanceof DuplicateVoteError) {
      status = HttpStatus.CONFLICT;
    } else if (exception instanceof SelfVoteError) {
      status = HttpStatus.FORBIDDEN;
    } else if (exception instanceof SelfReportError) {
      status = HttpStatus.FORBIDDEN;
    } else if (exception instanceof DuplicateReportError) {
      status = HttpStatus.CONFLICT;
    }

    response.status(status).json({
      statusCode: status,
      message: exception.message,
      error: exception.name,
    });
  }
}
