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
import { tap } from 'rxjs/operators';
import { randomUUID } from 'node:crypto';
import { PinoLogger } from 'nestjs-pino';
import { correlationIdStorage, getCorrelationId } from './correlation-id';

const CORRELATION_ID_HEADER = 'x-correlation-id';

@Injectable()
export class CorrelationInterceptor implements NestInterceptor {
  constructor(private readonly logger: PinoLogger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const incoming = request.headers[CORRELATION_ID_HEADER] as string | undefined;
    const correlationId: string =
      incoming && incoming.length > 0 && incoming.length <= 64 ? incoming : randomUUID();

    const response = context
      .switchToHttp()
      .getResponse<Response & { setHeader(name: string, value: string): void }>();
    response.setHeader(CORRELATION_ID_HEADER, correlationId);

    this.logger.assign({ correlationId });

    return correlationIdStorage.run({ correlationId }, () => {
      return next.handle().pipe(
        tap({
          finalize: () => {
            // clean-up if needed
          },
        }),
      );
    });
  }
}

export { getCorrelationId };
