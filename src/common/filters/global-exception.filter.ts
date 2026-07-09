import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { PinoLogger } from 'nestjs-pino';
import { serverConfig } from '@/core/config';
import type { ServerConfig } from '@/core/config';
import type { ProblemDetail } from '@/common/types/problem-detail.type';
import { RFC7807_TYPE_URIS } from '@/common/types/problem-detail.type';

type RequestWithLogger = Request & {
  id?: string;
  log?: Pick<PinoLogger, 'warn' | 'error'>;
};

type HttpExceptionResponseShape = {
  message?: string | string[];
  error?: string;
};

// this filter split into 3 cases: 1. HTTP exceptions, 2. Errors, 3. Non-error exceptions
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly logger: PinoLogger,
    @Inject(serverConfig.KEY)
    private readonly server: ServerConfig,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const isProduction = this.server.nodeEnv === 'production';
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<RequestWithLogger>();
    const requestLogger = this.getRequestLogger(request);

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let errorName = 'InternalServerError';

    // Handle HTTP exceptions
    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        errorName = exception.name;
      } else if (this.isHttpExceptionResponseShape(exceptionResponse)) {
        message = exceptionResponse.message ?? exception.message;
        errorName = exceptionResponse.error ?? exception.name;
      } else {
        message = exception.message;
        errorName = exception.name;
      }

      if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
        requestLogger.error({
          event: 'http_server_error',
          method: request.method,
          url: request.url,
          statusCode,
          error: errorName,
          details: message,
        });
      } else {
        requestLogger.warn({
          event: 'http_client_error',
          method: request.method,
          url: request.url,
          statusCode,
          error: errorName,
          details: message,
        });
      }
    } else if (exception instanceof Error) {
      errorName = 'InternalServerError';

      const causeChain: { name: string; message: string; code?: string }[] = [];
      let cursor: unknown = exception.cause;
      while (cursor instanceof Error && causeChain.length < 5) {
        causeChain.push({
          name: cursor.name,
          message: cursor.message,
          code: (cursor as Error & { code?: string }).code,
        });
        cursor = (cursor as Error & { cause?: unknown }).cause;
      }

      if (isProduction) {
        message = 'Internal server error';
        requestLogger.error({
          event: 'unhandled_exception',
          method: request.method,
          url: request.url,
          errorName: exception.name,
          errorMessage: exception.message,
          causeChain: causeChain.length > 0 ? causeChain : undefined,
        });
      } else {
        message =
          causeChain.length > 0
            ? `${exception.message}\nCause chain: ${JSON.stringify(causeChain)}`
            : exception.message;
        requestLogger.error({
          event: 'unhandled_exception',
          method: request.method,
          url: request.url,
          errorName: exception.name,
          errorMessage: exception.message,
          causeChain: causeChain.length > 0 ? causeChain : undefined,
          stack: exception.stack,
        });
      }
    } else {
      requestLogger.error({
        event: 'unhandled_non_error_exception',
        method: request.method,
        url: request.url,
        exception: String(exception),
      });
    }

    if (isProduction && statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      message = 'Internal server error';
      errorName = 'InternalServerError';
    }

    const problem: ProblemDetail = {
      type: RFC7807_TYPE_URIS[statusCode] ?? RFC7807_TYPE_URIS[500],
      title: errorName,
      status: statusCode,
      detail: Array.isArray(message) ? message.join('; ') : message,
      instance: request.originalUrl ?? request.url,
      extensions: {
        requestId: request.id,
      },
    };

    response.status(statusCode).json(problem);
  }

  private getRequestLogger(request: RequestWithLogger): Pick<PinoLogger, 'warn' | 'error'> {
    return request.log ?? this.logger;
  }

  private isHttpExceptionResponseShape(value: unknown): value is HttpExceptionResponseShape {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const shape = value as Record<string, unknown>;
    const message = shape.message;
    const error = shape.error;

    const isValidMessage =
      typeof message === 'string' ||
      (Array.isArray(message) && message.every((entry) => typeof entry === 'string')) ||
      message === undefined;

    const isValidError = typeof error === 'string' || error === undefined;

    return isValidMessage && isValidError;
  }
}
