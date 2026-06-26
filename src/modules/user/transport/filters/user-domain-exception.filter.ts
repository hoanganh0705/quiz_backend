import { Catch, HttpStatus, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { Request, Response } from 'express';
import {
  UserAnalyticsNotFoundError,
  UserDomainError,
  UserNotFoundError,
  UserProfilePrivateError,
  UserRankingNotFoundError,
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
 */
@Catch(UserDomainError, UserProfilePrivateError)
export class UserDomainExceptionFilter implements ExceptionFilter {
  constructor(
    @InjectPinoLogger(UserDomainExceptionFilter.name) private readonly logger: PinoLogger,
  ) {}

  catch(exception: UserDomainError | UserProfilePrivateError, host: ArgumentsHost): void {
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

  private mapToHttp(error: UserDomainError | UserProfilePrivateError): {
    status: number;
    title: string;
    detail: string;
  } {
    if (error instanceof UserNotFoundError) {
      return { status: HttpStatus.NOT_FOUND, title: 'NotFound', detail: 'User not found' };
    }

    if (error instanceof UserRankingNotFoundError) {
      return {
        status: HttpStatus.NOT_FOUND,
        title: 'NotFound',
        detail: 'User ranking not found',
      };
    }

    if (error instanceof UserAnalyticsNotFoundError) {
      return {
        status: HttpStatus.NOT_FOUND,
        title: 'NotFound',
        detail: 'User analytics not found',
      };
    }

    if (error instanceof UserProfilePrivateError) {
      return {
        status: HttpStatus.FORBIDDEN,
        title: 'Forbidden',
        detail: error.message,
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      title: 'InternalServerError',
      detail: 'Internal server error',
    };
  }
}
