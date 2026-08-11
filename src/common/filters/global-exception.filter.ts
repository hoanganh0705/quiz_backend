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

/**
 * Status → synthesized `code` for native `HttpException` paths (Phase 4
 * deliverable per plan §6.3 + §8.5). Lives with its sole consumer
 * (the global filter) — no separate registry, no generated artifact.
 *
 * Why this exists: clients that switch on `extensions.code` should not
 * be left empty-handed when the error came from a guard/pipe/interceptor
 * (`UnauthorizedException`, `BadRequestException`, etc.) instead of from
 * a domain exception class. With this table every RFC 7807 response
 * carries an `extensions.code` — domain exceptions go through
 * `ProblemCodeMapping`; everything else goes through this table.
 *
 * `GLOBAL_VALIDATION_FAILED` is special: it overrides
 * `GLOBAL_BAD_REQUEST` for the specific shape produced by NestJS
 * `ValidationPipe` (a `string[]` of field errors). Clients that
 * render per-field UI use this code to skip the
 * `detail: '...; ...; ...'` joined-string render and instead inspect
 * the `extensions.validationErrors` array (Phase 5+; not implemented).
 */
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
    let domainCode: string | undefined;
    let resolvedDomainInfo: ReturnType<typeof resolveProblemInfo> | undefined;

    // Handle domain exceptions FIRST. They are the most common case in this
    // codebase (every module's application layer throws `BaseDomainException`
    // subclasses). Resolving them through `ProblemCodeMapping` keeps the
    // mapping table the single source of HTTP semantics — the exception
    // itself only carries the business identifier (`code`).
    if (exception instanceof BaseDomainException) {
      domainCode = exception.code;
      const info = resolveProblemInfo(domainCode);
      const isKnownCode: boolean = domainCode in ProblemCodeMapping;

      if (!isKnownCode) {
        // Loud-failure branch — the migration plan (§6.4) requires that
        // every concrete class's `code` has a mapping entry. A missing
        // entry is a developer error (typo, forgotten co-commit), not
        // a runtime error. Surface it loudly so the gap is observable.
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
      // Stash the resolved info so the wire builder below doesn't call
      // `resolveProblemInfo` a second time.
      resolvedDomainInfo = info;

      // Skip the standard http_client_error / http_server_error log line
      // for unknown codes — the `unknown_error_code` log above already
      // carries the relevant context (code, exceptionName, request URL).
      // Logging both would double the on-call noise for a developer error.
      if (isKnownCode) {
        // Log domain errors at the same level as native HttpException:
        // 4xx → warn, 5xx → error.
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

      // Phase 4 (§6.3 + §8.5): synthesize `extensions.code` for native
      // `HttpException` paths so clients can switch on `code` uniformly
      // for domain AND non-domain errors. Two overrides exist:
      //
      // 1. `BadRequestException` carrying a `string[]` message (the
      //    shape produced by NestJS `ValidationPipe`) emits
      //    `GLOBAL_VALIDATION_FAILED` instead of the default
      //    `GLOBAL_BAD_REQUEST`. Clients rendering per-field UI use
      //    this code to skip the joined-string `detail` and instead
      //    inspect the `extensions.validationErrors` array (Phase 5+,
      //    not yet implemented).
      //
      // 2. 5xx without an explicit table entry falls back to
      //    `GLOBAL_INTERNAL_ERROR`. The table only enumerates
      //    client-error status codes + `429`; 5xx is the catch-all
      //    bucket. Per §6.3: "5xx → GLOBAL_INTERNAL_ERROR".
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
      // Phase 4 (§6.3): every 5xx carries `extensions.code =
      // 'GLOBAL_INTERNAL_ERROR'` so clients switching on `code` see
      // a uniform value across uncaught Errors, 5xx `HttpException`
      // (e.g. `InternalServerErrorException` thrown directly), and
      // unexpected 502/503/504 paths that fall through the table.
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

    // Phase 5 (S-27): promote per-field validation errors from the
    // domain `QuizValidationFieldError` carrier into the wire
    // `extensions.validationErrors` array so the editor can wire
    // `react-hook-form`'s `setError(field, ...)` inline error UI.
    const validationErrors =
      exception instanceof BaseDomainException &&
      'fieldErrors' in exception &&
      Array.isArray((exception as { fieldErrors: unknown }).fieldErrors)
        ? ((exception as unknown as {
            fieldErrors: Array<{ field: string; message: string }>;
          }).fieldErrors)
        : undefined;

    const problem: ProblemDetail = {
      type: typeUri,
      title: errorName,
      status: statusCode,
      detail: Array.isArray(message) ? message.join('; ') : message,
      instance: request.originalUrl ?? request.url,
      extensions: {
        requestId: request.id,
        // ISO 8601 timestamp of when this response was generated.
        // Added in Phase 3.1 (per RFC 7807 migration plan §8.4.1) so
        // every error response carries a consistent timestamp +
        // requestId pair. Clients may use either to correlate a
        // response with server-side logs.
        timestamp: new Date().toISOString(),
        ...(domainCode !== undefined ? { code: domainCode } : {}),
        ...(validationErrors !== undefined ? { validationErrors } : {}),
      },
    };

    // Phase 5 (S-27): set `Retry-After` on 429 responses so HTTP
    // cache-aware clients can back off correctly. The ThrottlerGuard
    // surfaces `retryAfter` on the thrown `ThrottlerException`
    // instance; we use it when present and fall back to the ttl/1000
    // heuristic otherwise.
    if (statusCode === HttpStatus.TOO_MANY_REQUESTS) {
      const retryAfterSeconds =
        exception instanceof HttpException &&
        'retryAfter' in (exception as unknown as Record<string, unknown>)
          ? Number((exception as unknown as { retryAfter?: number }).retryAfter ?? 60)
          : 60;
      response.setHeader('Retry-After', String(retryAfterSeconds));
      if (problem.extensions) {
        (problem.extensions as Record<string, unknown>).retryAfter = retryAfterSeconds;
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
