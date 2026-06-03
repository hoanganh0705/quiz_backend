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
  SessionNotFoundError,
  InvalidTokenError,
  InvalidPasswordError,
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
    if (error instanceof InvalidCredentialsError) {
      return { status: HttpStatus.UNAUTHORIZED, message: 'Invalid credentials provided.' };
    }
    if (error instanceof InvalidRefreshTokenError) {
      return { status: HttpStatus.UNAUTHORIZED, message: 'Invalid refresh token.' };
    }
    if (error instanceof TokenReuseDetectedError) {
      return { status: HttpStatus.UNAUTHORIZED, message: 'Token reuse detected.' };
    }
    if (error instanceof SessionContextMismatchError) {
      return { status: HttpStatus.UNAUTHORIZED, message: 'Session context mismatch.' };
    }
    if (error instanceof UserNotFoundError) {
      return { status: HttpStatus.UNAUTHORIZED, message: 'User not found.' };
    }
    if (error instanceof RateLimitExceededError) {
      return { status: HttpStatus.TOO_MANY_REQUESTS, message: 'Rate limit exceeded.' };
    }
    if (error instanceof SessionNotFoundError) {
      return { status: HttpStatus.NOT_FOUND, message: 'Session not found.' };
    }
    if (error instanceof InvalidTokenError) {
      return { status: HttpStatus.BAD_REQUEST, message: 'Invalid or expired token.' };
    }
    if (error instanceof InvalidPasswordError) {
      return { status: HttpStatus.UNAUTHORIZED, message: 'Invalid current password.' };
    }

    // Fallback for any AuthDomainError subclass not explicitly mapped.
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'An internal authentication error occurred.',
    };
  }
}
