import { Catch, HttpStatus, type ExceptionFilter, type ArgumentsHost } from '@nestjs/common';
import type { Response } from 'express';
import {
  BookmarkDomainError,
  CollectionNotFoundError,
  CollectionForbiddenError,
  CollectionConflictError,
  BookmarkNotFoundError,
  BookmarkForbiddenError,
  BookmarkConflictError,
  BookmarkValidationError,
} from '../../domain/errors';

const HTTP_ERROR_NAMES: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'Bad Request',
  [HttpStatus.FORBIDDEN]: 'Forbidden',
  [HttpStatus.NOT_FOUND]: 'Not Found',
  [HttpStatus.CONFLICT]: 'Conflict',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'Internal Server Error',
};

@Catch(BookmarkDomainError)
export class BookmarkDomainExceptionFilter implements ExceptionFilter {
  catch(exception: BookmarkDomainError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const { status, message } = this.mapToHttp(exception);

    response.status(status).json({
      statusCode: status,
      message,
      error: HTTP_ERROR_NAMES[status] ?? 'Error',
    });
  }

  private mapToHttp(error: BookmarkDomainError): { status: number; message: string } {
    if (error instanceof CollectionNotFoundError || error instanceof BookmarkNotFoundError) {
      return { status: HttpStatus.NOT_FOUND, message: 'Resource not found' };
    }

    if (error instanceof CollectionForbiddenError || error instanceof BookmarkForbiddenError) {
      return { status: HttpStatus.FORBIDDEN, message: 'You do not have permission to perform this action' };
    }

    if (error instanceof CollectionConflictError || error instanceof BookmarkConflictError) {
      return { status: HttpStatus.CONFLICT, message: 'Resource already exists' };
    }

    if (error instanceof BookmarkValidationError) {
      return { status: HttpStatus.BAD_REQUEST, message: 'Invalid request data' };
    }

    return { status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Internal server error' };
  }
}
