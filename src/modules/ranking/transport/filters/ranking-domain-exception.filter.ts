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
        message = `${(exceptionResponse as { message?: string }).message ?? exceptionResponse.toString()}`;
        code = (exceptionResponse as { code?: string }).code ?? this.getCodeFromStatus(status);
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

  private getCodeFromStatus(status: number): string {
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
