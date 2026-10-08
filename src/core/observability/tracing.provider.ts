import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
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
  endTimeNs?: bigint;
  status: SpanStatus;
  attributes: Record<string, string | number | boolean>;
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

  getActiveSpanCount(): number {
    return this.activeSpans.size;
  }

  /**
   * Wait until a span with the supplied `name` and matching `attributes`
   * predicate has been emitted via `flush()`. Designed for tests that want
   * to assert that a code path produced a trace span without coupling to
   * the async flush cadence. Returns the matched span (or `undefined` if
   * nothing matched within `timeoutMs`).
   */
  async assertSpan(
    name: string,
    predicate: (attributes: Record<string, string | number | boolean>) => boolean = () => true,
    timeoutMs = 1_000,
  ): Promise<Span | undefined> {
    const matched = (span: Span): boolean => {
      if (span.name !== name) return false;
      return predicate(span.attributes);
    };

    for (const span of this.completedSpans) {
      if (matched(span)) return span;
    }

    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      for (const span of this.completedSpans) {
        if (matched(span)) return span;
      }
    }
    return undefined;
  }

  protected flush(): void {
    if (this.completedSpans.length === 0) return;
    const spans = this.completedSpans.splice(0, this.completedSpans.length);
    for (const span of spans) {
      const durationMs =
        span.endTimeNs !== undefined ? Number(span.endTimeNs - span.startTimeNs) / 1_000_000 : 0;
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
  return randomHex(16);
};

const generateSpanId = (): string => {
  return randomHex(8);
};

const randomHex = (bytes: number): string => {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Buffer.from(buf).toString('hex');
};
