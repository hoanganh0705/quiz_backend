/**
 * Phase 5 #1 — HTTP tracing interceptor.
 *
 * Opens a `server` span on every incoming HTTP request, attaches
 * standard attributes (`http.method`, `http.route`,
 * `http.status_code`), and ends the span when the response
 * completes. The span is associated with a parent if the caller
 * passed a `traceparent` header (W3C trace context).
 *
 * Why an interceptor and not middleware?
 * -------------------------------------
 * Interceptors in NestJS run *after* the validation pipe and the
 * global exception filter, which means the span is closed only
 * once the entire request has been handled. Middleware runs too
 * early to see exceptions from the validation pipe.
 */
import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { catchError, Observable, tap } from 'rxjs';
import type { Request, Response } from 'express';
import {
  TRACING_PROVIDER,
  type Span,
  type SpanContext,
  type TracingProvider,
} from '@/core/observability/tracing.provider';

const TRACEPARENT_HEADER = 'traceparent';
/**
 * Parses `traceparent` per the W3C Trace Context spec.
 * Format: `00-<trace_id 32 hex>-<span_id 16 hex>-<flags 2 hex>`.
 * Returns null on any parse failure so an unparseable header
 * falls back to a fresh trace rather than crashing the request.
 */
const parseTraceparent = (header: string | undefined): SpanContext | null => {
  if (!header) return null;
  const parts = header.split('-');
  if (parts.length !== 4) return null;
  const [, traceId, spanId] = parts;
  if (!/^[0-9a-f]{32}$/.test(traceId)) return null;
  if (!/^[0-9a-f]{16}$/.test(spanId)) return null;
  return { traceId, spanId };
};

@Injectable()
export class HttpTracingInterceptor implements NestInterceptor {
  constructor(
    @Inject(TRACING_PROVIDER)
    private readonly tracing: TracingProvider,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request & { route?: { path?: string } }>();
    const res = http.getResponse<Response>();

    const parent = parseTraceparent(
      req.headers[TRACEPARENT_HEADER] as string | undefined,
    );

    const routePath =
      (req.route?.path as string | undefined) ??
      (req.path as string | undefined) ??
      'unknown';

    const span = this.tracing.startSpan(
      `HTTP ${req.method ?? 'UNKNOWN'} ${routePath}`,
      {
        kind: 'server',
        parent: parent ?? undefined,
        attributes: {
          'http.method': String(req.method ?? 'UNKNOWN'),
          'http.route': routePath,
          'http.url': req.originalUrl ?? req.url ?? '',
          'http.user_agent': String(req.headers['user-agent'] ?? ''),
        },
      },
    );

    return next.handle().pipe(
      tap(() => {
        finalizeSpan(span, this.tracing, res.statusCode);
      }),
      catchError((error: unknown) => {
        finalizeSpan(span, this.tracing, res.statusCode ?? 500);
        // Re-throw so the global exception filter handles it.
        throw error;
      }),
    );
  }
}

const finalizeSpan = (
  span: Span,
  tracing: TracingProvider,
  statusCode: number | undefined,
): void => {
  span.attributes['http.status_code'] = statusCode ?? 0;
  span.attributes['http.status_class'] =
    statusCode === undefined ? 'unknown' : `${Math.floor(statusCode / 100)}xx`;
  tracing.endSpan(span, statusCode !== undefined && statusCode < 500 ? 'ok' : 'error');
};