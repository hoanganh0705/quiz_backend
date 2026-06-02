import { Catch, HttpStatus, type ExceptionFilter, type ArgumentsHost } from '@nestjs/common';
import type { Response } from 'express';
import {
  ReviewDomainError,
  ReviewNotFoundError,
  ReviewForbiddenError,
  ReviewConflictError,
  ReviewValidationError,
  ReviewAttemptRequiredError,
} from '../../domain/errors';

const HTTP_ERROR_NAMES: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'Bad Request',
  [HttpStatus.FORBIDDEN]: 'Forbidden',
  [HttpStatus.NOT_FOUND]: 'Not Found',
  [HttpStatus.CONFLICT]: 'Conflict',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'Internal Server Error',
};

@Catch(ReviewDomainError)
export class ReviewDomainExceptionFilter implements ExceptionFilter {
  catch(exception: ReviewDomainError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const { status, message } = this.mapToHttp(exception);

    response.status(status).json({
      statusCode: status,
      message,
      error: HTTP_ERROR_NAMES[status] ?? 'Error',
    });
  }

  private mapToHttp(error: ReviewDomainError): { status: number; message: string } {
    if (error instanceof ReviewNotFoundError) {
      return { status: HttpStatus.NOT_FOUND, message: 'Review not found' };
    }

    if (error instanceof ReviewForbiddenError) {
      return {
        status: HttpStatus.FORBIDDEN,
        message: 'You do not have permission to perform this action',
      };
    }

    if (error instanceof ReviewConflictError) {
      return { status: HttpStatus.CONFLICT, message: 'Resource already exists' };
    }

    if (error instanceof ReviewValidationError || error instanceof ReviewAttemptRequiredError) {
      return { status: HttpStatus.BAD_REQUEST, message: 'Invalid request data' };
    }

    return { status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Internal server error' };
  }
}
