import { Catch, HttpStatus, type ExceptionFilter, type ArgumentsHost } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { Request, Response } from 'express';
import {
  AttemptDomainError,
  AttemptNotFoundError,
  AttemptForbiddenError,
  AttemptValidationError,
  AttemptAlreadyStartedError,
  AttemptNotActiveError,
  AttemptQuestionAlreadyAnsweredError,
  QuizNotPublishedError,
  AttemptQuestionInvalidError,
  AttemptNotCompletedError,
} from '../../domain/errors';
import { RFC7807_TYPE_URIS, type ProblemDetail } from '@/common/types/problem-detail.type';

type RequestWithLogger = Request & {
  id?: string;
  log?: Pick<PinoLogger, 'warn' | 'error'>;
};

/**
 * Maps attempt domain-layer errors to RFC 7807 Problem Details responses so the
 * domain can remain free of framework-specific exception types while preserving
 * identical HTTP status codes and a consistent response envelope across the API.
 *
 * The shape mirrors `GlobalExceptionFilter`, `AuthDomainExceptionFilter`, and
 * `QuizDomainExceptionFilter` so clients see one error envelope across the entire
 * API.
 */
@Catch(AttemptDomainError)
export class AttemptDomainExceptionFilter implements ExceptionFilter {
  constructor(
    @InjectPinoLogger(AttemptDomainExceptionFilter.name) private readonly logger: PinoLogger,
  ) {}

  catch(exception: AttemptDomainError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<RequestWithLogger>();

    const { status, title, detail } = this.mapToHttp(exception);

    const problem: ProblemDetail = {
      type: RFC7807_TYPE_URIS[status] ?? RFC7807_TYPE_URIS[500],
      title,
      status,
      detail,
      instance: request.originalUrl ?? request.url,
      extensions: {
        requestId: request.id,
      },
    };

    const isServerError = status >= 500;

    if (isServerError) {
      this.logger.error({
        event: 'attempt_unhandled_domain_error',
        errorType: exception.constructor.name,
        errorMessage: exception.message,
        stack: exception.stack,
        method: request.method,
        url: request.url,
      });
    } else {
      (request.log ?? this.logger).warn({
        event: 'http_client_error',
        method: request.method,
        url: request.url,
        statusCode: status,
        error: title,
        details: detail,
      });
    }

    response.status(status).json(problem);
  }

  private mapToHttp(error: AttemptDomainError): {
    status: number;
    title: string;
    detail: string;
  } {
    if (error instanceof AttemptNotFoundError) {
      return {
        status: HttpStatus.NOT_FOUND,
        title: 'NotFound',
        detail: error.message || 'Quiz attempt not found',
      };
    }

    if (error instanceof AttemptForbiddenError) {
      return {
        status: HttpStatus.FORBIDDEN,
        title: 'Forbidden',
        detail: error.message || 'You do not have permission to access this attempt',
      };
    }

    if (
      error instanceof AttemptAlreadyStartedError ||
      error instanceof AttemptNotActiveError ||
      error instanceof AttemptQuestionAlreadyAnsweredError
    ) {
      return {
        status: HttpStatus.CONFLICT,
        title: 'Conflict',
        detail: error.message || 'Attempt conflict',
      };
    }

    if (error instanceof QuizNotPublishedError) {
      return {
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        title: 'UnprocessableEntity',
        detail: error.message || 'This quiz is not published and cannot be attempted',
      };
    }

    if (error instanceof AttemptQuestionInvalidError) {
      return {
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        title: 'UnprocessableEntity',
        detail: error.message || 'Question is invalid for this attempt',
      };
    }

    if (error instanceof AttemptNotCompletedError) {
      return {
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        title: 'UnprocessableEntity',
        detail: error.message || 'Analytics are only available for completed attempts',
      };
    }

    if (error instanceof AttemptValidationError) {
      return {
        status: HttpStatus.BAD_REQUEST,
        title: 'BadRequest',
        detail: error.message || 'Invalid request data',
      };
    }

    // Fallback for any AttemptDomainError subclass not explicitly mapped.
    this.logger.error({
      event: 'attempt_unmapped_domain_error',
      errorType: error.constructor.name,
      errorMessage: error.message,
      stack: error.stack,
    });
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      title: 'InternalServerError',
      detail: 'Internal server error',
    };
  }
}
