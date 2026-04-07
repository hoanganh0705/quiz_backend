import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { PinoLogger } from 'nestjs-pino';

type RequestWithLogger = Request & {
  id?: string;
  log?: Pick<PinoLogger, 'warn' | 'error'>;
};

type HttpExceptionResponseShape = {
  message?: string | string[];
  error?: string;
};

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly logger: PinoLogger,
    private readonly configService: ConfigService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<RequestWithLogger>();
    const requestLogger = this.getRequestLogger(request);

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error = 'InternalServerError';

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        error = exception.name;
      } else if (this.isHttpExceptionResponseShape(exceptionResponse)) {
        message = exceptionResponse.message ?? exception.message;
        error = exceptionResponse.error ?? exception.name;
      } else {
        message = exception.message;
        error = exception.name;
      }

      if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
        requestLogger.error({
          event: 'http_server_error',
          method: request.method,
          url: request.url,
          statusCode,
          error,
          details: message,
        });
      } else {
        requestLogger.warn({
          event: 'http_client_error',
          method: request.method,
          url: request.url,
          statusCode,
          error,
          details: message,
        });
      }
    } else if (exception instanceof Error) {
      message = isProduction ? 'Internal server error' : exception.message;
      error = 'InternalServerError';

      if (isProduction) {
        requestLogger.error({
          event: 'unhandled_exception',
          method: request.method,
          url: request.url,
          errorName: exception.name,
          errorMessage: exception.message,
        });
      } else {
        requestLogger.error({
          event: 'unhandled_exception',
          method: request.method,
          url: request.url,
          errorName: exception.name,
          errorMessage: exception.message,
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
      error = 'InternalServerError';
    }

    response.status(statusCode).json({
      data: {
        statusCode,
        message,
        error,
        requestId: request.id,
        path: request.url,
        method: request.method,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
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
