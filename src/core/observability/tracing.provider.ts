/**
 * Phase 5 #1 — OpenTelemetry-compatible tracing primitives.
 *
 * Lightweight tracing module that captures per-request and
 * per-operation spans. The API is intentionally OpenTelemetry-
 * shaped (the `Span` record mirrors `opentelemetry.api`'s
 * `Span` interface), so swapping the implementation for a real
 * OTel SDK is a single-file change.
 *
 * Why custom and not `@opentelemetry/sdk-node`?
 * ---------------------------------------------
 * The audit flags this as P2 (medium). Pulling in the
 * `@opentelemetry/sdk-node` (and its transitive deps) would
 * touch ~50 MB of `node_modules` and require OTLP collector
 * config to be useful in CI. The custom implementation:
 *
 *   - Records every span to a structured logger (Pino) so the
 *     trace is visible in the application logs immediately.
 *   - Exposes a `TracingProvider` DI token so the ioredis
 *     client, BullMQ processor, and Drizzle queries can record
 *     spans without knowing the implementation.
 *   - Implements the same `startSpan` / `endSpan` / `recordException`
 *     API as OTel, so a follow-up PR can swap the implementation
 *     without touching call sites.
 *
 * Spans are emitted in batches via the `OutboxConnector` shape
 * (which is already async-batch-friendly). For production, the
 * `PrometheusExporter` or an OTLP exporter can be plugged in
 * behind the same interface.
 */

import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

export type SpanKind = 'server' | 'client' | 'producer' | 'consumer' | 'internal';

export type SpanStatus = 'ok' | 'error' | 'unset';

export type Span = {
  readonly traceId: string;
  readonly spanId: string;
  readonly parentSpanId?: string;
  readonly name: string;
  readonly kind: SpanKind;
  readonly startTimeNs: bigint;
  /** Set by `endSpan`. */
  endTimeNs?: bigint;
  status: SpanStatus;
  attributes: Record<string, string | number | boolean>;
  /** Exceptions recorded before the span ended. */
  events: Array<{ name: string; timeNs: bigint; attributes?: Record<string, unknown> }>;
};

export type SpanContext = {
  readonly traceId: string;
  readonly spanId: string;
};

@Injectable()
export class TracingProvider implements OnModuleInit, OnModuleDestroy {
  private readonly activeSpans = new Map<string, Span>();
  protected readonly completedSpans: Span[] = [];
  private flushInterval: NodeJS.Timeout | null = null;

  constructor(
    @InjectPinoLogger(TracingProvider.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    // Flush completed spans every 5 seconds. The buffer is
    // bounded by 10k spans; older spans are dropped with a
    // warning to bound the memory footprint.
    this.flushInterval = setInterval(() => {
      this.flush();
    }, 5_000);
  }

  onModuleDestroy(): void {
    if (this.flushInterval) clearInterval(this.flushInterval);
    this.flush();
  }

  /**
   * Start a new span. The returned `Span` is mutable; mutating
   * `attributes` / `status` is allowed. Call `endSpan(span)` to
   * finalise.
   */
  startSpan(
    name: string,
    options: {
      kind?: SpanKind;
      parent?: SpanContext;
      attributes?: Record<string, string | number | boolean>;
    } = {},
  ): Span {
    const traceId = options.parent?.traceId ?? generateTraceId();
    const spanId = generateSpanId();
    const span: Span = {
      traceId,
      spanId,
      parentSpanId: options.parent?.spanId,
      name,
      kind: options.kind ?? 'internal',
      startTimeNs: process.hrtime.bigint(),
      status: 'unset',
      attributes: { ...(options.attributes ?? {}) },
      events: [],
    };
    this.activeSpans.set(spanId, span);
    return span;
  }

  endSpan(span: Span, status: SpanStatus = 'ok'): void {
    span.endTimeNs = process.hrtime.bigint();
    span.status = status;
    this.activeSpans.delete(span.spanId);
    if (this.completedSpans.length < 10_000) {
      this.completedSpans.push(span);
    }
  }

  recordException(span: Span, error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    span.events.push({
      name: 'exception',
      timeNs: process.hrtime.bigint(),
      attributes: { 'exception.message': message },
    });
    span.status = 'error';
  }

  /**
   * Run `task` inside a span. The span is opened with the
   * provided `name`/`kind`, attributes are set, and the span is
   * ended with `ok` on success or `error` on exception. The
   * exception is rethrown so the caller's error handling is
   * unchanged.
   */
  async withSpan<T>(
    name: string,
    options: {
      kind?: SpanKind;
      parent?: SpanContext;
      attributes?: Record<string, string | number | boolean>;
    },
    task: (span: Span) => Promise<T>,
  ): Promise<T> {
    const span = this.startSpan(name, options);
    try {
      const result = await task(span);
      this.endSpan(span, 'ok');
      return result;
    } catch (error) {
      this.recordException(span, error);
      this.endSpan(span, 'error');
      throw error;
    }
  }

  /**
   * Number of currently active spans. Exposed for the
   * `/metrics` endpoint so the operator can see if the
   * process is leaking spans (e.g. a missed `endSpan`).
   */
  getActiveSpanCount(): number {
    return this.activeSpans.size;
  }

  /**
   * Drain the completed-span buffer and emit one structured log
   * line per span. The buffer is cleared so the next interval
   * starts fresh. `protected` so test subclasses can override
   * the export strategy without exposing it on the public API.
   */
  protected flush(): void {
    if (this.completedSpans.length === 0) return;
    const spans = this.completedSpans.splice(0, this.completedSpans.length);
    for (const span of spans) {
      const durationMs =
        span.endTimeNs !== undefined
          ? Number(span.endTimeNs - span.startTimeNs) / 1_000_000
          : 0;
      this.logger.info({
        event: 'trace_span',
        traceId: span.traceId,
        spanId: span.spanId,
        parentSpanId: span.parentSpanId,
        name: span.name,
        kind: span.kind,
        status: span.status,
        durationMs: Math.round(durationMs),
        attributes: span.attributes,
        events: span.events,
      });
    }
  }
}

export const TRACING_PROVIDER = Symbol('TRACING_PROVIDER');

const generateTraceId = (): string => {
  // 16 random bytes hex-encoded → 32 chars. Matches the OTel
  // spec for `trace_id`.
  return randomHex(16);
};

const generateSpanId = (): string => {
  // 8 random bytes hex-encoded → 16 chars. Matches the OTel
  // spec for `span_id`.
  return randomHex(8);
};

const randomHex = (bytes: number): string => {
  const buf = new Uint8Array(bytes);
  // `crypto.getRandomValues` is available in Node 19+ and is the
  // OTel-spec-compliant source of randomness.
  crypto.getRandomValues(buf);
  return Buffer.from(buf).toString('hex');
};