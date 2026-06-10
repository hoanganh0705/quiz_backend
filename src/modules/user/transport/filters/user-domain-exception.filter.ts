import { Catch, HttpStatus, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import {
  UserAnalyticsNotFoundError,
  UserDomainError,
  UserNotFoundError,
  UserProfilePrivateError,
  UserRankingNotFoundError,
} from '../../domain/errors';

const HTTP_ERROR_NAMES: Record<number, string> = {
  [HttpStatus.NOT_FOUND]: 'Not Found',
  [HttpStatus.FORBIDDEN]: 'Forbidden',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'Internal Server Error',
};

/**
 * Maps domain-layer errors to HTTP responses so the domain can remain
 * free of framework-specific exception types while preserving identical
 * HTTP status codes and response bodies.
 */
@Catch(UserDomainError)
export class UserDomainExceptionFilter implements ExceptionFilter {
  catch(exception: UserDomainError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const { status, message } = this.mapToHttp(exception);

    response.status(status).json({
      statusCode: status,
      message,
      error: HTTP_ERROR_NAMES[status] ?? 'Error',
    });
  }

  private mapToHttp(error: UserDomainError): { status: number; message: string } {
    if (error instanceof UserNotFoundError) {
      return { status: HttpStatus.NOT_FOUND, message: 'User not found' };
    }

    if (error instanceof UserRankingNotFoundError) {
      return { status: HttpStatus.NOT_FOUND, message: 'User ranking not found' };
    }

    if (error instanceof UserAnalyticsNotFoundError) {
      return { status: HttpStatus.NOT_FOUND, message: 'User analytics not found' };
    }

    if (error instanceof UserProfilePrivateError) {
      return { status: HttpStatus.FORBIDDEN, message: error.message };
    }

    return { status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Internal server error' };
  }
}
