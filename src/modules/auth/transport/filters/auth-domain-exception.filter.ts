import { Catch, HttpStatus, type ExceptionFilter, type ArgumentsHost } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { Request, Response } from 'express';
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
  DeletionFailedError,
  PasswordReuseError,
  InvalidOAuthTokenError,
  OAuthAccountLinkingRequiredError,
} from '../../domain/errors';
import { RFC7807_TYPE_URIS, type ProblemDetail } from '@/common/types/problem-detail.type';

type RequestWithLogger = Request & {
  id?: string;
  log?: Pick<PinoLogger, 'warn' | 'error'>;
};

/**
 * Maps domain-layer errors to RFC 7807 Problem Details responses so the domain
 * can remain free of framework-specific exception types while preserving
 * identical HTTP status codes and response bodies.
 *
 * The shape matches the global exception filter so clients see a consistent
 * error envelope across the entire API.
 */
@Catch(AuthDomainError)
export class AuthDomainExceptionFilter implements ExceptionFilter {
  constructor(
    @InjectPinoLogger(AuthDomainExceptionFilter.name) private readonly logger: PinoLogger,
  ) {}

  catch(exception: AuthDomainError, host: ArgumentsHost): void {
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

    if (status >= Number(HttpStatus.INTERNAL_SERVER_ERROR)) {
      this.logger.error({
        event: 'http_server_error',
        method: request.method,
        url: request.url,
        statusCode: status,
        error: title,
        details: detail,
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

  private mapToHttp(error: AuthDomainError): {
    status: number;
    title: string;
    detail: string;
  } {
    if (error instanceof InvalidCredentialsError) {
      return {
        status: HttpStatus.UNAUTHORIZED,
        title: 'Unauthorized',
        detail: 'Invalid credentials provided.',
      };
    }
    if (error instanceof InvalidRefreshTokenError) {
      return {
        status: HttpStatus.UNAUTHORIZED,
        title: 'Unauthorized',
        detail: 'Invalid refresh token.',
      };
    }
    if (error instanceof TokenReuseDetectedError) {
      return {
        status: HttpStatus.UNAUTHORIZED,
        title: 'Unauthorized',
        detail: 'Token reuse detected.',
      };
    }
    if (error instanceof SessionContextMismatchError) {
      return {
        status: HttpStatus.UNAUTHORIZED,
        title: 'Unauthorized',
        detail: 'Session context mismatch.',
      };
    }
    if (error instanceof UserNotFoundError) {
      return {
        status: HttpStatus.UNAUTHORIZED,
        title: 'Unauthorized',
        detail: 'User not found.',
      };
    }
    if (error instanceof RateLimitExceededError) {
      return {
        status: HttpStatus.TOO_MANY_REQUESTS,
        title: 'TooManyRequests',
        detail: 'Rate limit exceeded.',
      };
    }
    if (error instanceof SessionNotFoundError) {
      return {
        status: HttpStatus.NOT_FOUND,
        title: 'NotFound',
        detail: 'Session not found.',
      };
    }
    if (error instanceof InvalidTokenError) {
      return {
        status: HttpStatus.BAD_REQUEST,
        title: 'BadRequest',
        detail: 'Invalid or expired token.',
      };
    }
    if (error instanceof InvalidPasswordError) {
      return {
        status: HttpStatus.UNAUTHORIZED,
        title: 'Unauthorized',
        detail: 'Invalid current password.',
      };
    }
    if (error instanceof DeletionFailedError) {
      return {
        status: HttpStatus.CONFLICT,
        title: 'Conflict',
        detail: 'Account deletion failed.',
      };
    }
    if (error instanceof PasswordReuseError) {
      return {
        status: HttpStatus.CONFLICT,
        title: 'Conflict',
        detail: error.message,
      };
    }
    if (error instanceof InvalidOAuthTokenError) {
      return {
        status: HttpStatus.UNAUTHORIZED,
        title: 'Unauthorized',
        detail: 'Invalid or expired OAuth credentials.',
      };
    }
    if (error instanceof OAuthAccountLinkingRequiredError) {
      return {
        status: HttpStatus.CONFLICT,
        title: 'Conflict',
        detail: error.message,
      };
    }

    this.logger.error({
      event: 'auth_unhandled_domain_error',
      errorType: error.constructor.name,
      errorMessage: error.message,
      stack: error.stack,
    });

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      title: 'InternalServerError',
      detail: 'An internal authentication error occurred.',
    };
  }
}
