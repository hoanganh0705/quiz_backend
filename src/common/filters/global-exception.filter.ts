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
import { BaseDomainException } from '@/common/errors/base-domain.exception';
import { ProblemCodeMapping, resolveProblemInfo } from '@/common/errors/problem-code-mapping';
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

const STATUS_TO_GLOBAL_CODE: Readonly<Record<number, string>> = {
  [HttpStatus.BAD_REQUEST]: 'GLOBAL_BAD_REQUEST',
  [HttpStatus.UNAUTHORIZED]: 'GLOBAL_UNAUTHENTICATED',
  [HttpStatus.FORBIDDEN]: 'GLOBAL_FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'GLOBAL_NOT_FOUND',
  [HttpStatus.CONFLICT]: 'GLOBAL_CONFLICT',
  [HttpStatus.METHOD_NOT_ALLOWED]: 'GLOBAL_METHOD_NOT_ALLOWED',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'GLOBAL_UNPROCESSABLE',
  [HttpStatus.TOO_MANY_REQUESTS]: 'GLOBAL_RATE_LIMITED',
};

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
    let domainCode: string | undefined;
    let resolvedDomainInfo: ReturnType<typeof resolveProblemInfo> | undefined;

    if (exception instanceof BaseDomainException) {
      domainCode = exception.code;
      const info = resolveProblemInfo(domainCode);
      const isKnownCode: boolean = domainCode in ProblemCodeMapping;

      if (!isKnownCode) {
        requestLogger.error({
          event: 'unknown_error_code',
          code: domainCode,
          exceptionName: exception.name,
          method: request.method,
          url: request.url,
        });
      }

      statusCode = info.status;
      errorName = info.title;
      message = exception.message;
      resolvedDomainInfo = info;

      if (isKnownCode) {
        if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
          requestLogger.error({
            event: 'http_server_error',
            method: request.method,
            url: request.url,
            statusCode,
            code: domainCode,
            error: errorName,
            details: message,
          });
        } else {
          requestLogger.warn({
            event: 'http_client_error',
            method: request.method,
            url: request.url,
            statusCode,
            code: domainCode,
            error: errorName,
            details: message,
          });
        }
      }
    } else if (exception instanceof HttpException) {
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

      if (
        statusCode === HttpStatus.BAD_REQUEST &&
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null &&
        Array.isArray((exceptionResponse as { message?: unknown }).message)
      ) {
        domainCode = 'GLOBAL_VALIDATION_FAILED';
      } else if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
        domainCode = 'GLOBAL_INTERNAL_ERROR';
      } else {
        domainCode = STATUS_TO_GLOBAL_CODE[statusCode] ?? 'GLOBAL_INTERNAL_ERROR';
      }

      if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
        requestLogger.error({
          event: 'http_server_error',
          method: request.method,
          url: request.url,
          statusCode,
          code: domainCode,
          error: errorName,
          details: message,
        });
      } else {
        requestLogger.warn({
          event: 'http_client_error',
          method: request.method,
          url: request.url,
          statusCode,
          code: domainCode,
          error: errorName,
          details: message,
        });
      }
    } else if (exception instanceof Error) {
      errorName = 'InternalServerError';
      domainCode = 'GLOBAL_INTERNAL_ERROR';

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
        message = 'Internal server error';
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

    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      message = 'Internal server error';
      errorName = 'InternalServerError';
    }

    const typeUri =
      resolvedDomainInfo !== undefined
        ? resolvedDomainInfo.typeUri
        : (RFC7807_TYPE_URIS[statusCode] ?? RFC7807_TYPE_URIS[500]);

    const validationErrors =
      exception instanceof BaseDomainException &&
      'fieldErrors' in exception &&
      Array.isArray((exception as { fieldErrors: unknown }).fieldErrors)
        ? (
            exception as unknown as {
              fieldErrors: Array<{ field: string; message: string }>;
            }
          ).fieldErrors
        : undefined;

    const problem: ProblemDetail = {
      type: typeUri,
      title: errorName,
      status: statusCode,
      detail: Array.isArray(message) ? message.join('; ') : message,
      instance: request.originalUrl ?? request.url,
      extensions: {
        requestId: request.id,
        timestamp: new Date().toISOString(),
        ...(domainCode !== undefined ? { code: domainCode } : {}),
        ...(validationErrors !== undefined ? { validationErrors } : {}),
      },
    };

    if (statusCode === HttpStatus.TOO_MANY_REQUESTS) {
      const retryAfterSeconds =
        exception instanceof HttpException &&
        'retryAfter' in (exception as unknown as Record<string, unknown>)
          ? Number((exception as unknown as { retryAfter?: number }).retryAfter ?? 60)
          : 60;
      response.setHeader('Retry-After', String(retryAfterSeconds));
      if (problem.extensions) {
        problem.extensions.retryAfter = retryAfterSeconds;
      }
    }

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
