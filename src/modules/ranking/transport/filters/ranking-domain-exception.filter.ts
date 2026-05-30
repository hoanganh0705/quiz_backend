/**
 * Ranking Domain Exception Filter
 *
 * Handles domain-specific exceptions for the ranking controller.
 */

import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

@Catch()
export class RankingDomainExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(RankingDomainExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code = 'INTERNAL_ERROR';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        message = this.extractMessage(exceptionResponse);
        code = this.extractCode(exceptionResponse) ?? this.getCodeFromStatus(status);
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      this.logger.error({
        event: 'ranking_exception',
        error: exception.message,
        stack: exception.stack,
      });
    }

    response.status(status).json({
      statusCode: status,
      message,
      code,
      timestamp: new Date().toISOString(),
    });
  }

  private extractMessage(exceptionResponse: object): string {
    if ('message' in exceptionResponse) {
      const { message } = exceptionResponse as { message?: unknown };

      if (typeof message === 'string') {
        return message;
      }

      if (Array.isArray(message)) {
        return message.filter((item): item is string => typeof item === 'string').join(', ');
      }
    }

    return 'Unexpected error';
  }

  private extractCode(exceptionResponse: object): string | undefined {
    if ('code' in exceptionResponse) {
      const { code } = exceptionResponse as { code?: unknown };
      return typeof code === 'string' ? code : undefined;
    }

    return undefined;
  }

  private getCodeFromStatus(status: HttpStatus): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'BAD_REQUEST';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      default:
        return 'INTERNAL_ERROR';
    }
  }
}
