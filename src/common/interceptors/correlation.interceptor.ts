/**
 * Correlation Interceptor
 *
 * Extracts the `x-correlation-id` header (or generates a UUID) at the entry point
 * of every request and stores it in `correlationIdStorage`.
 *
 * The correlation ID is then available to all downstream code (services, repositories)
 * via `getCorrelationId()`. NestJS pino child loggers automatically include it
 * when the interceptor assigns it via `pino.assign()`.
 */

import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { PinoLogger } from 'nestjs-pino';
import { correlationIdStorage, getCorrelationId } from './correlation-id';
import { CORRELATION_ID_HEADER, sanitizeCorrelationId } from './correlation-id-validator';

@Injectable()
export class CorrelationInterceptor implements NestInterceptor {
  constructor(private readonly logger: PinoLogger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const incoming = request.headers[CORRELATION_ID_HEADER] as string | undefined;
    const correlationId = sanitizeCorrelationId(incoming);

    const response = context
      .switchToHttp()
      .getResponse<Response & { setHeader(name: string, value: string): void }>();
    response.setHeader(CORRELATION_ID_HEADER, correlationId);

    this.logger.assign({ correlationId });

    return correlationIdStorage.run({ correlationId }, () => next.handle());
  }
}

export { getCorrelationId };
