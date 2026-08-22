/**
 * Unit tests for `RedisCircuitBreaker`.
 *
 * We test the *fail-open* contract that the breaker enforces:
 *   1. Closed → open after N consecutive failures.
 *   2. While open, every call returns the supplied fallback (no
 *      upstream call attempts).
 *   3. After the cool-down, the next call is allowed through and
 *      either closes the breaker (probe success) or re-opens it
 *      (probe failure).
 *   4. The `shortCircuitedCount` metric only increments on actual
 *      short-circuit events.
 */

import { RedisCircuitBreaker } from './redis-circuit-breaker';

describe('RedisCircuitBreaker', () => {
  let now: number;
  const FAILURE_THRESHOLD = 3;
  const RESET_TIMEOUT_MS = 1_000;
  const options = {
    failureThreshold: FAILURE_THRESHOLD,
    resetTimeoutMs: RESET_TIMEOUT_MS,
    now: () => now,
  };

  beforeEach(() => {
    now = 0;
  });

  /**
   * Helper: drive the breaker to the `open` state. The intermediate
   * task failures are *expected* — the test cases only care about the
   * state transition, not the individual error shapes.
   */
  const tripBreaker = async (breaker: RedisCircuitBreaker, reason = 'redis down') => {
    for (let i = 0; i < FAILURE_THRESHOLD; i += 1) {
      try {
        await breaker.exec('fallback', async () => {
          throw new Error(reason);
        });
      } catch {
        // Expected: the breaker only suppresses CircuitOpenError. A
        // closed-breaker call that fails lets the original error
        // propagate so the caller can react.
      }
    }
  };

  it('returns the task result when the breaker is closed', async () => {
    const breaker = new RedisCircuitBreaker(options);
    const result = await breaker.exec('fallback', async () => 'value');
    expect(result).toBe('value');
    expect(breaker.getState()).toBe('closed');
    expect(breaker.getShortCircuitedCount()).toBe(0);
  });

  it('opens the breaker after N consecutive failures', async () => {
    const breaker = new RedisCircuitBreaker(options);
    await tripBreaker(breaker);
    expect(breaker.getState()).toBe('open');
  });

  it('returns the fallback (fail-open) when the breaker is open', async () => {
    const breaker = new RedisCircuitBreaker(options);
    await tripBreaker(breaker);

    let upstreamCalls = 0;
    const result = await breaker.exec('fallback', async () => {
      upstreamCalls += 1;
      return 'value';
    });

    expect(result).toBe('fallback');
    expect(upstreamCalls).toBe(0);
    expect(breaker.getShortCircuitedCount()).toBe(1);
  });

  it('does not invoke the upstream while the breaker is open and the cool-down has not elapsed', async () => {
    const breaker = new RedisCircuitBreaker(options);
    await tripBreaker(breaker);

    let upstreamCalls = 0;
    await breaker.exec('fallback', async () => {
      upstreamCalls += 1;
      return 'value';
    });
    await breaker.exec('fallback', async () => {
      upstreamCalls += 1;
      return 'value';
    });

    expect(upstreamCalls).toBe(0);
    expect(breaker.getShortCircuitedCount()).toBe(2);
  });

  it('transitions to half-open after the cool-down and closes on a successful probe', async () => {
    const breaker = new RedisCircuitBreaker(options);
    await tripBreaker(breaker);
    expect(breaker.getState()).toBe('open');

    // Advance the clock past the cool-down.
    now = RESET_TIMEOUT_MS + 1;

    const result = await breaker.exec('fallback', async () => 'recovered');
    expect(result).toBe('recovered');
    expect(breaker.getState()).toBe('closed');
    expect(breaker.getConsecutiveFailures()).toBe(0);
  });

  it('re-opens when the half-open probe fails', async () => {
    const breaker = new RedisCircuitBreaker(options);
    await tripBreaker(breaker);
    now = RESET_TIMEOUT_MS + 1;

    await expect(
      breaker.exec('fallback', async () => {
        throw new Error('still down');
      }),
    ).rejects.toThrow('still down');

    expect(breaker.getState()).toBe('open');
  });

  it('resets the failure counter on a single success', async () => {
    const breaker = new RedisCircuitBreaker(options);

    // Two failures — under threshold.
    try {
      await breaker.exec('fallback', async () => { throw new Error('one'); });
    } catch {
      // expected
    }
    try {
      await breaker.exec('fallback', async () => { throw new Error('two'); });
    } catch {
      // expected
    }
    expect(breaker.getConsecutiveFailures()).toBe(2);

    // One success — counter resets.
    await breaker.exec('fallback', async () => 'ok');
    expect(breaker.getConsecutiveFailures()).toBe(0);
    expect(breaker.getState()).toBe('closed');
  });

  it('emits state transitions to a listener', async () => {
    const breaker = new RedisCircuitBreaker(options);
    const transitions: Array<{ from: string; to: string }> = [];
    breaker.setStateChangeListener((t) => transitions.push(t));

    await tripBreaker(breaker);

    expect(transitions).toEqual([{ from: 'closed', to: 'open' }]);

    now = RESET_TIMEOUT_MS + 1;
    await breaker.exec('fallback', async () => 'recovered');

    expect(transitions).toEqual([
      { from: 'closed', to: 'open' },
      { from: 'open', to: 'half-open' },
      { from: 'half-open', to: 'closed' },
    ]);
  });

  it('getMetrics returns the breaker state, failure count, and short-circuit count', async () => {
    const breaker = new RedisCircuitBreaker(options);
    await tripBreaker(breaker);
    await breaker.exec('fallback', async () => 'x'); // short-circuit
    await breaker.exec('fallback', async () => 'y'); // short-circuit

    const metrics = breaker.getMetrics();
    expect(metrics.state).toBe('open');
    expect(metrics.consecutiveFailures).toBe(FAILURE_THRESHOLD);
    expect(metrics.shortCircuitedCount).toBe(2);
  });

  it('rejects invalid options', () => {
    expect(() => new RedisCircuitBreaker({ failureThreshold: 0, resetTimeoutMs: 1000 })).toThrow();
    expect(() => new RedisCircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 0 })).toThrow();
  });
});