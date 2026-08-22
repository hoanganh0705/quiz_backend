/**
 * Phase 5 #2 — Metrics registry unit tests.
 *
 * Covers the Prometheus text-format export contract:
 *   - Counter increments produce a `_total` series.
 *   - Gauges emit one row per label set.
 *   - Histograms expand into `_bucket`, `_count`, `_sum`.
 *   - `render()` returns the canonical Prometheus format with
 *     `# HELP` and `# TYPE` comments.
 */

import { MetricsRegistry } from './metrics.registry';

class TestLogger {
  readonly info = jest.fn();
  readonly warn = jest.fn();
  readonly error = jest.fn();
  readonly debug = jest.fn();
}

const makeRegistry = (): MetricsRegistry => {
  return new MetricsRegistry(new TestLogger() as unknown as never);
};

describe('MetricsRegistry', () => {
  it('renders HELP and TYPE comments for every metric', () => {
    const registry = makeRegistry();
    const output = registry.render();
    expect(output).toContain('# HELP quiz_http_request_duration_seconds');
    expect(output).toContain('# TYPE quiz_http_request_duration_seconds histogram');
    expect(output).toContain('# HELP quiz_redis_circuit_state');
    expect(output).toContain('# TYPE quiz_redis_circuit_state gauge');
  });

  it('increments the Redis circuit short-circuit counter', () => {
    const registry = makeRegistry();
    registry.incRedisCircuitShortCircuits();
    registry.incRedisCircuitShortCircuits();
    registry.incRedisCircuitShortCircuits();
    const output = registry.render();
    expect(output).toMatch(
      /quiz_redis_circuit_short_circuited_total\{[^}]*\} 3/,
    );
  });

  it('records HTTP duration observations and emits bucket rows', () => {
    const registry = makeRegistry();
    registry.observeHttpDuration(
      { route: '/quizzes', method: 'GET', status: '200' },
      0.02,
    );
    registry.observeHttpDuration(
      { route: '/quizzes', method: 'GET', status: '200' },
      0.5,
    );
    const output = registry.render();
    expect(output).toMatch(/quiz_http_request_duration_seconds_bucket/);
    expect(output).toMatch(/quiz_http_request_duration_seconds_count\{[^}]*\} 2/);
    expect(output).toMatch(/quiz_http_request_duration_seconds_sum/);
  });

  it('updates the Redis circuit state gauge', () => {
    const registry = makeRegistry();
    registry.setRedisCircuitState('open');
    const output = registry.render();
    expect(output).toMatch(/quiz_redis_circuit_state\{state="open"\} 1/);
    expect(output).toMatch(/quiz_redis_circuit_state\{state="closed"\} 0/);
    expect(output).toMatch(/quiz_redis_circuit_state\{state="half_open"\} 0/);
  });

  it('records the outbox lag gauge', () => {
    const registry = makeRegistry();
    registry.setOutboxLag(42);
    const output = registry.render();
    expect(output).toMatch(/quiz_outbox_lag_seconds\{[^}]*\} 42/);
  });

  it('records the BullMQ queue depth gauge', () => {
    const registry = makeRegistry();
    registry.setBullmqQueueDepth('email', 5);
    const output = registry.render();
    expect(output).toMatch(/quiz_bullmq_queue_depth\{queue="email"\} 5/);
  });

  it('records the tracing active spans gauge', () => {
    const registry = makeRegistry();
    registry.setTracingActiveSpans(13);
    const output = registry.render();
    expect(output).toMatch(/quiz_tracing_active_spans\{[^}]*\} 13/);
  });
});