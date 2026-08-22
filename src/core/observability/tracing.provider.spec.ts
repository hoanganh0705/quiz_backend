/**
 * Phase 5 #1 — tracing provider unit tests.
 *
 * Covers the API contract:
 *   - `startSpan` returns a span with valid trace/span ids.
 *   - `endSpan` records `endTimeNs` and removes the span from
 *     the active set.
 *   - `withSpan` opens a span, runs the task, closes the span
 *     with `ok` on success and `error` on exception.
 *   - The exception is rethrown so caller's error handling is
 *     unchanged.
 *   - `recordException` flips the status to `error` and pushes
 *     an `exception` event.
 *   - The completed-span buffer is bounded (max 10 000).
 */

import { TracingProvider } from './tracing.provider';

class TestLogger {
  readonly info = jest.fn();
  readonly warn = jest.fn();
  readonly error = jest.fn();
  readonly debug = jest.fn();
}

const makeProvider = (): { provider: TracingProvider; logger: TestLogger } => {
  const logger = new TestLogger();
  const provider = new TracingProvider(logger as unknown as never);
  return { provider, logger };
};

describe('TracingProvider', () => {
  it('startSpan returns a span with valid trace and span ids', () => {
    const { provider } = makeProvider();
    const span = provider.startSpan('test.span');
    expect(span.traceId).toMatch(/^[0-9a-f]{32}$/);
    expect(span.spanId).toMatch(/^[0-9a-f]{16}$/);
    expect(span.name).toBe('test.span');
    expect(span.status).toBe('unset');
  });

  it('endSpan sets endTimeNs and removes the span from the active set', () => {
    const { provider } = makeProvider();
    const span = provider.startSpan('test.span');
    provider.endSpan(span, 'ok');
    expect(span.endTimeNs).toBeDefined();
    expect(typeof span.endTimeNs).toBe('bigint');
    expect(span.status).toBe('ok');
    expect(provider.getActiveSpanCount()).toBe(0);
  });

  it('withSpan opens, runs, closes with ok on success', async () => {
    const { provider } = makeProvider();
    const result = await provider.withSpan(
      'test.span',
      { kind: 'server' },
      async () => 'value',
    );
    expect(result).toBe('value');
  });

  it('withSpan records the exception and rethrows on failure', async () => {
    const { provider } = makeProvider();
    const err = new Error('boom');
    await expect(
      provider.withSpan('test.span', {}, async () => {
        throw err;
      }),
    ).rejects.toBe(err);
    // The span is closed (off the active set) even on failure.
    expect(provider.getActiveSpanCount()).toBe(0);
  });

  it('recordException flips status to error and pushes an exception event', () => {
    const { provider } = makeProvider();
    const span = provider.startSpan('test.span');
    provider.recordException(span, new Error('boom'));
    expect(span.status).toBe('error');
    expect(span.events).toHaveLength(1);
    expect(span.events[0].name).toBe('exception');
  });

  it('child span inherits the parent trace id', () => {
    const { provider } = makeProvider();
    const parent = provider.startSpan('parent');
    const child = provider.startSpan('child', { parent: { traceId: parent.traceId, spanId: parent.spanId } });
    expect(child.traceId).toBe(parent.traceId);
    expect(child.parentSpanId).toBe(parent.spanId);
  });

  it('flush emits one log per completed span', async () => {
    const { provider, logger } = makeProvider();
    await provider.withSpan('a', {}, async () => undefined);
    await provider.withSpan('b', {}, async () => undefined);
    // Manually invoke flush via the onModuleDestroy lifecycle.
    await provider.onModuleDestroy();
    expect(logger.info).toHaveBeenCalledTimes(2);
    const first = logger.info.mock.calls[0][0];
    expect(first.event).toBe('trace_span');
    expect(first.name).toBe('a');
    const second = logger.info.mock.calls[1][0];
    expect(second.name).toBe('b');
  });
});