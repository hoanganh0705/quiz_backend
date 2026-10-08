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
    expect(output).toMatch(/quiz_redis_circuit_short_circuited_total\{[^}]*\} 3/);
  });

  it('records HTTP duration observations and emits bucket rows', () => {
    const registry = makeRegistry();
    registry.observeHttpDuration({ route: '/quizzes', method: 'GET', status: '200' }, 0.02);
    registry.observeHttpDuration({ route: '/quizzes', method: 'GET', status: '200' }, 0.5);
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

  it('increments the scheduler-skipped counter per job', () => {
    const registry = makeRegistry();
    registry.incSchedulerSkipped('ranking-dirty-rankings');
    registry.incSchedulerSkipped('ranking-dirty-rankings');
    registry.incSchedulerSkipped('tournament-registration-open');
    const output = registry.render();
    expect(output).toMatch(/quiz_scheduler_skipped_total\{job="ranking-dirty-rankings"\} 2/);
    expect(output).toMatch(/quiz_scheduler_skipped_total\{job="tournament-registration-open"\} 1/);
  });

  it('renders the scheduler-skipped counter with HELP and TYPE comments', () => {
    const registry = makeRegistry();
    const output = registry.render();
    expect(output).toContain('# HELP quiz_scheduler_skipped_total');
    expect(output).toContain('# TYPE quiz_scheduler_skipped_total counter');
  });

  it('increments the cache invalidation failure counter per cache', () => {
    const registry = makeRegistry();
    registry.incCacheInvalidationFailed('quiz-list');
    registry.incCacheInvalidationFailed('quiz-list');
    registry.incCacheInvalidationFailed('quiz-stats');
    const output = registry.render();
    expect(output).toMatch(/quiz_cache_invalidation_failed_total\{cache="quiz-list"\} 2/);
    expect(output).toMatch(/quiz_cache_invalidation_failed_total\{cache="quiz-stats"\} 1/);
  });

  it('increments the per-cache hit and miss counters', () => {
    const registry = makeRegistry();
    registry.incCacheHit('quiz-list');
    registry.incCacheHit('quiz-list');
    registry.incCacheHit('quiz-list');
    registry.incCacheMiss('quiz-list');
    registry.incCacheMiss('quiz-stats');
    const output = registry.render();
    expect(output).toMatch(/quiz_cache_hit_total\{cache="quiz-list"\} 3/);
    expect(output).toMatch(/quiz_cache_miss_total\{cache="quiz-list"\} 1/);
    expect(output).toMatch(/quiz_cache_miss_total\{cache="quiz-stats"\} 1/);
  });

  it('increments the outbox-handler-failed counter per aggregate type', () => {
    const registry = makeRegistry();
    registry.incOutboxHandlerFailed('attempt_xp');
    registry.incOutboxHandlerFailed('attempt_xp');
    registry.incOutboxHandlerFailed('daily_challenge_xp');
    const output = registry.render();
    expect(output).toMatch(/quiz_outbox_handler_failed_total\{aggregate_type="attempt_xp"\} 2/);
    expect(output).toMatch(
      /quiz_outbox_handler_failed_total\{aggregate_type="daily_challenge_xp"\} 1/,
    );
  });

  it('increments the xp-ingest duplicate-skipped counter per source', () => {
    const registry = makeRegistry();
    registry.incXpIngestDuplicateSkipped('in_proc');
    registry.incXpIngestDuplicateSkipped('in_proc');
    registry.incXpIngestDuplicateSkipped('outbox');
    registry.incXpIngestDuplicateSkipped('manual');
    const output = registry.render();
    expect(output).toMatch(/quiz_xp_ingest_duplicate_skipped_total\{source="in_proc"\} 2/);
    expect(output).toMatch(/quiz_xp_ingest_duplicate_skipped_total\{source="outbox"\} 1/);
    expect(output).toMatch(/quiz_xp_ingest_duplicate_skipped_total\{source="manual"\} 1/);
  });

  it('sets the retry-queue dead-letter gauge per tier', () => {
    const registry = makeRegistry();
    registry.setRetryQueueDlqSize('attempt', 12);
    registry.setRetryQueueDlqSize('coin', 3);
    const output = registry.render();
    expect(output).toContain('# HELP quiz_retry_queue_dlq_size');
    expect(output).toContain('# TYPE quiz_retry_queue_dlq_size gauge');
    expect(output).toMatch(/quiz_retry_queue_dlq_size\{tier="attempt"\} 12/);
    expect(output).toMatch(/quiz_retry_queue_dlq_size\{tier="coin"\} 3/);
  });

  it('overwrites the previous tier value when re-set (gauge, not counter)', () => {
    const registry = makeRegistry();
    registry.setRetryQueueDlqSize('attempt', 12);
    registry.setRetryQueueDlqSize('attempt', 7);
    const output = registry.render();
    expect(output).toMatch(/quiz_retry_queue_dlq_size\{tier="attempt"\} 7/);
  });

  it('increments the HTTP log volume counter per path/method/status', () => {
    const registry = makeRegistry();
    registry.incHttpLogVolume('/users/by-username/alice', 'GET', '200');
    registry.incHttpLogVolume('/users/by-username/alice', 'GET', '200');
    registry.incHttpLogVolume('/health', 'GET', '200');
    const output = registry.render();
    expect(output).toContain('# HELP quiz_http_log_volume_total');
    expect(output).toContain('# TYPE quiz_http_log_volume_total counter');
    expect(output).toMatch(
      /quiz_http_log_volume_total\{method="GET",path="\/users\/by-username\/alice",status="200"\} 2/,
    );
    expect(output).toMatch(
      /quiz_http_log_volume_total\{method="GET",path="\/health",status="200"\} 1/,
    );
  });
});
