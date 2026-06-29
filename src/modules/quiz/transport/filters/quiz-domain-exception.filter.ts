import { Catch, HttpStatus, type ExceptionFilter, type ArgumentsHost } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { Request, Response } from 'express';
import {
  QuizDomainError,
  QuizNotFoundError,
  QuizForbiddenError,
  QuizConflictError,
  QuizSlugConflictError,
  QuizValidationError,
  QuizVersionImmutableError,
  QuizInsufficientQuestionsError,
  QuizQuestionPositionConflictError,
  QuizAnswerOptionPositionConflictError,
  QuizMultipleCorrectOptionsError,
} from '../../domain/errors';
import { RFC7807_TYPE_URIS, type ProblemDetail } from '@/common/types/problem-detail.type';

type RequestWithLogger = Request & {
  id?: string;
  log?: Pick<PinoLogger, 'warn' | 'error'>;
};

/**
 * Maps quiz domain-layer errors to RFC 7807 Problem Details responses so the
 * domain can remain free of framework-specific exception types while preserving
 * identical HTTP status codes and a consistent response envelope across the API.
 *
 * The shape mirrors `GlobalExceptionFilter` (and `AuthDomainExceptionFilter`)
 * so clients see one error envelope across the entire API.
 */
@Catch(QuizDomainError)
export class QuizDomainExceptionFilter implements ExceptionFilter {
  constructor(
    @InjectPinoLogger(QuizDomainExceptionFilter.name) private readonly logger: PinoLogger,
  ) {}

  catch(exception: QuizDomainError, host: ArgumentsHost): void {
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
        event: 'quiz_unhandled_domain_error',
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

  private mapToHttp(error: QuizDomainError): {
    status: number;
    title: string;
    detail: string;
  } {
    if (error instanceof QuizNotFoundError) {
      return {
        status: HttpStatus.NOT_FOUND,
        title: 'NotFound',
        detail: error.message || 'Quiz not found',
      };
    }

    if (error instanceof QuizForbiddenError) {
      return {
        status: HttpStatus.FORBIDDEN,
        title: 'Forbidden',
        detail: error.message || 'You do not have permission to perform this action',
      };
    }

    if (error instanceof QuizSlugConflictError) {
      return {
        status: HttpStatus.CONFLICT,
        title: 'Conflict',
        detail: error.message || 'A quiz with this slug already exists',
      };
    }

    if (error instanceof QuizConflictError) {
      return {
        status: HttpStatus.CONFLICT,
        title: 'Conflict',
        detail: error.message || 'Resource conflict',
      };
    }

    if (error instanceof QuizQuestionPositionConflictError) {
      return {
        status: HttpStatus.CONFLICT,
        title: 'Conflict',
        detail: error.message,
      };
    }

    if (error instanceof QuizAnswerOptionPositionConflictError) {
      return {
        status: HttpStatus.CONFLICT,
        title: 'Conflict',
        detail: error.message,
      };
    }

    if (error instanceof QuizMultipleCorrectOptionsError) {
      return {
        status: HttpStatus.BAD_REQUEST,
        title: 'BadRequest',
        detail: error.message,
      };
    }

    if (error instanceof QuizValidationError) {
      return {
        status: HttpStatus.BAD_REQUEST,
        title: 'BadRequest',
        detail: error.message,
      };
    }

    if (error instanceof QuizInsufficientQuestionsError) {
      return {
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        title: 'UnprocessableEntity',
        detail: error.message,
      };
    }

    if (error instanceof QuizVersionImmutableError) {
      return {
        status: HttpStatus.BAD_REQUEST,
        title: 'BadRequest',
        detail: 'This quiz version cannot be modified',
      };
    }

    // Fallback for any QuizDomainError subclass not explicitly mapped.
    this.logger.error({
      event: 'quiz_unmapped_domain_error',
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
