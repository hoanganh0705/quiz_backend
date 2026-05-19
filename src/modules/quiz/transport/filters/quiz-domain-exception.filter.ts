import { Catch, HttpStatus, type ExceptionFilter, type ArgumentsHost } from '@nestjs/common';
import type { Response } from 'express';
import {
  QuizDomainError,
  QuizNotFoundError,
  QuizForbiddenError,
  QuizConflictError,
  QuizValidationError,
  QuizVersionImmutableError,
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
@Catch(QuizDomainError)
export class QuizDomainExceptionFilter implements ExceptionFilter {
  catch(exception: QuizDomainError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const { status, message } = this.mapToHttp(exception);

    response.status(status).json({
      statusCode: status,
      message,
      error: HTTP_ERROR_NAMES[status] ?? 'Error',
    });
  }

  private mapToHttp(error: QuizDomainError): { status: number; message: string } {
    if (error instanceof QuizNotFoundError) {
      return { status: HttpStatus.NOT_FOUND, message: error.message };
    }

    if (error instanceof QuizForbiddenError) {
      return { status: HttpStatus.FORBIDDEN, message: error.message };
    }

    if (error instanceof QuizConflictError) {
      return { status: HttpStatus.CONFLICT, message: error.message };
    }

    if (error instanceof QuizValidationError) {
      return { status: HttpStatus.BAD_REQUEST, message: error.message };
    }

    if (error instanceof QuizVersionImmutableError) {
      return { status: HttpStatus.BAD_REQUEST, message: error.message };
    }

    // Fallback for any QuizDomainError subclass not explicitly mapped.
    return { status: HttpStatus.INTERNAL_SERVER_ERROR, message: error.message };
  }
}
