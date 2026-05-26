import { Catch, HttpStatus, type ExceptionFilter, type ArgumentsHost } from '@nestjs/common';
import type { Response } from 'express';
import {
  AttemptDomainError,
  AttemptNotFoundError,
  AttemptForbiddenError,
  AttemptConflictError,
  AttemptValidationError,
  AttemptAlreadyStartedError,
  AttemptAlreadyFinishedError,
  QuizNotPublishedError,
} from '../../domain/errors';

const HTTP_ERROR_NAMES: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'Bad Request',
  [HttpStatus.FORBIDDEN]: 'Forbidden',
  [HttpStatus.NOT_FOUND]: 'Not Found',
  [HttpStatus.CONFLICT]: 'Conflict',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'Internal Server Error',
};

/**
 * Maps domain-layer errors to HTTP responses so the domain can remain
 * free of framework-specific exception types while preserving identical
 * HTTP status codes and response bodies.
 */
@Catch(AttemptDomainError)
export class AttemptDomainExceptionFilter implements ExceptionFilter {
  catch(exception: AttemptDomainError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const { status, message } = this.mapToHttp(exception);

    response.status(status).json({
      statusCode: status,
      message,
      error: HTTP_ERROR_NAMES[status] ?? 'Error',
    });
  }

  private mapToHttp(error: AttemptDomainError): { status: number; message: string } {
    if (error instanceof AttemptNotFoundError) {
      return { status: HttpStatus.NOT_FOUND, message: 'Quiz attempt not found' };
    }

    if (error instanceof AttemptForbiddenError) {
      return { status: HttpStatus.FORBIDDEN, message: 'You do not have permission to access this attempt' };
    }

    if (
      error instanceof AttemptConflictError ||
      error instanceof AttemptAlreadyStartedError ||
      error instanceof AttemptAlreadyFinishedError
    ) {
      return { status: HttpStatus.CONFLICT, message: 'Attempt conflict' };
    }

    if (error instanceof QuizNotPublishedError) {
      return { status: HttpStatus.BAD_REQUEST, message: 'This quiz is not available for attempts' };
    }

    if (error instanceof AttemptValidationError) {
      return { status: HttpStatus.BAD_REQUEST, message: 'Invalid request data' };
    }

    // Fallback for any AttemptDomainError subclass not explicitly mapped.
    return { status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Internal server error' };
  }
}
