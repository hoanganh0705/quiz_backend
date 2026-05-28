import { Catch, HttpStatus, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import {
  CategoryDomainError,
  CategoryNotFoundError,
  CategorySlugConflictError,
} from '../../domain/errors';

const HTTP_ERROR_NAMES: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'Bad Request',
  [HttpStatus.NOT_FOUND]: 'Not Found',
  [HttpStatus.CONFLICT]: 'Conflict',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'Internal Server Error',
};

/**
 * Maps domain-layer errors to HTTP responses so the domain can remain
 * free of framework-specific exception types while preserving identical
 * HTTP status codes and response bodies.
 */
@Catch(CategoryDomainError)
export class CategoryDomainExceptionFilter implements ExceptionFilter {
  catch(exception: CategoryDomainError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const { status, message } = this.mapToHttp(exception);

    response.status(status).json({
      statusCode: status,
      message,
      error: HTTP_ERROR_NAMES[status] ?? 'Error',
    });
  }

  private mapToHttp(error: CategoryDomainError): { status: number; message: string } {
    if (error instanceof CategoryNotFoundError) {
      return { status: HttpStatus.NOT_FOUND, message: 'Category not found' };
    }

    if (error instanceof CategorySlugConflictError) {
      return { status: HttpStatus.CONFLICT, message: 'A category with this slug already exists' };
    }

    return { status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Internal server error' };
  }
}
