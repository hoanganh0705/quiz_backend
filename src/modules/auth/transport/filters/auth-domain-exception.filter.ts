import {
  Catch,
  HttpException,
  HttpStatus,
  type ExceptionFilter,
  type ArgumentsHost,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  AuthDomainError,
  InvalidCredentialsError,
  InvalidRefreshTokenError,
  TokenReuseDetectedError,
  SessionContextMismatchError,
  UserNotFoundError,
  RateLimitExceededError,
} from '../../domain/errors';

/**
 * Maps domain-layer errors to HTTP responses so the domain can remain
 * free of framework-specific exception types while preserving identical
 * HTTP status codes and response bodies.
 */
@Catch(AuthDomainError)
export class AuthDomainExceptionFilter implements ExceptionFilter {
  catch(exception: AuthDomainError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const { status, message } = this.mapToHttp(exception);

    response.status(status).json({
      statusCode: status,
      message,
      error: HttpException.createBody('', '', status).error ?? 'Error',
    });
  }

  private mapToHttp(error: AuthDomainError): { status: number; message: string } {
    if (
      error instanceof InvalidCredentialsError ||
      error instanceof InvalidRefreshTokenError ||
      error instanceof TokenReuseDetectedError ||
      error instanceof SessionContextMismatchError ||
      error instanceof UserNotFoundError
    ) {
      return { status: HttpStatus.UNAUTHORIZED, message: error.message };
    }

    if (error instanceof RateLimitExceededError) {
      return { status: HttpStatus.TOO_MANY_REQUESTS, message: error.message };
    }

    // Fallback for any AuthDomainError subclass not explicitly mapped.
    return { status: HttpStatus.INTERNAL_SERVER_ERROR, message: error.message };
  }
}
