import { Catch, HttpStatus, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import {
  TagAlreadyActiveError,
  TagAnalyticsNotFoundError,
  TagDomainError,
  TagNotFoundError,
  TagRestoreInvariantError,
  TagSlugConflictError,
} from '../../domain/errors';

const HTTP_ERROR_NAMES: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'Bad Request',
  [HttpStatus.NOT_FOUND]: 'Not Found',
  [HttpStatus.CONFLICT]: 'Conflict',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'Internal Server Error',
};

@Catch(TagDomainError)
export class TagDomainExceptionFilter implements ExceptionFilter {
  catch(exception: TagDomainError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const { status, message } = this.mapToHttp(exception);

    response.status(status).json({
      statusCode: status,
      message,
      error: HTTP_ERROR_NAMES[status] ?? 'Error',
    });
  }

  private mapToHttp(error: TagDomainError): { status: number; message: string } {
    if (error instanceof TagNotFoundError) {
      return { status: HttpStatus.NOT_FOUND, message: 'Tag not found' };
    }

    if (error instanceof TagAnalyticsNotFoundError) {
      return { status: HttpStatus.NOT_FOUND, message: 'Tag analytics not found' };
    }

    if (error instanceof TagSlugConflictError) {
      return { status: HttpStatus.CONFLICT, message: 'A tag with this slug already exists' };
    }

    if (error instanceof TagAlreadyActiveError) {
      return {
        status: HttpStatus.CONFLICT,
        message: 'Tag is already active and cannot be restored',
      };
    }

    if (error instanceof TagRestoreInvariantError) {
      return { status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Internal server error' };
    }

    return { status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Internal server error' };
  }
}
