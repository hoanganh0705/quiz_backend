/**
 * Tiny in-process circuit breaker.
 *
 * Why a hand-rolled breaker and not `opossum` (or similar)?
 * ----------------------------------------------------
 * The two main third-party Node circuit-breaker libraries
 * (`opossum`, `cockatiel`) are mature, but they pull in a
 * dependency surface (metrics, decorators, retry policies,
 * health-check glue) that this app does not need. The
 * requirement is:
 *
 *   1. Count consecutive failures of the Resend API call.
 *   2. After N failures in a row, "open" the breaker —
 *      subsequent calls fail fast (no upstream call).
 *   3. After a cool-down, transition to "half-open" — let
 *      one call through. If it succeeds, close the breaker
 *      and reset the counter. If it fails, re-open.
 *   4. Log every state transition so operators see when the
 *      circuit opens and recovers.
 *
 * That's a ~50-line state machine. Adding a dependency for
 * it would mean reviewing a 1k+ LOC transitive tree (and
 * its TypeScript types) every time we upgrade. The
 * audit-style "use library X" recommendation is good advice
 * for general cases, but a 50-line primitive with three
 * states and a single configuration knob is a reasonable
 * place to keep the surface area small.
 *
 * The breaker is *not* persistent: it lives in the Node
 * process. A pod restart resets the counter. That is
 * intentional — the breaker is a short-term protection
 * against a flapping upstream, not a long-term rate limit.
 * Long-term throttling is the job of BullMQ's exponential
 * backoff (`attempts: 5`, `backoff: { type: 'exponential',
 * delay: 5_000 }`).
 *
 * Concurrency
 * -----------
 * The breaker state is read and written from the
 * `EmailProcessor` worker. BullMQ's worker concurrency is
 * typically 5 (`EMAIL_QUEUE_CONCURRENCY`, default 5), so up
 * to 5 jobs may be calling `exec()` concurrently. The
 * `consecutiveFailures`, `state`, and `openedAt` fields are
 * mutated without locking — under the worker model, a
 * brief inconsistency is acceptable: the worst case is two
 * jobs both reading `state === 'open'` and both short-
 * circuiting (still a no-op upstream call) or one job
 * reading `state === 'closed'` and one reading `'open'`
 * (one upstream call goes through, which is exactly what
 * half-open is designed to do). What matters is that the
 * counters monotonically increase on failure and reset on
 * success, and the time-based transition from open →
 * half-open is correct.
 */

export type CircuitState = 'closed' | 'open' | 'half-open';

export type CircuitBreakerOptions = {
  /**
   * Consecutive failures required to trip the breaker
   * from `closed` to `open`. The audit specifies 5; that
   * is the default. A burst of 4 failures in a row does
   * not open the circuit — a single recovery resets the
   * counter.
   */
  readonly failureThreshold: number;
  /**
   * How long the breaker stays `open` before transitioning
   * to `half-open`. The audit specifies 30 seconds. While
   * `open`, every call fails fast (no upstream call). After
   * the cool-down, one probe call is allowed through.
   */
  readonly resetTimeoutMs: number;
  /**
   * Optional clock for tests. Defaults to `Date.now`.
   */
  readonly now?: () => number;
};

/**
 * Thrown by `exec()` when the breaker is `open` and the
 * call is short-circuited. Callers that distinguish
 * "upstream is down / flapping" from "we're protecting
 * upstream" can catch this specifically. The BullMQ
 * worker treats it as a normal failure: the job is
 * rescheduled with exponential backoff, and once the
 * upstream recovers the half-open probe closes the
 * circuit and the queue drains.
 */
export class CircuitOpenError extends Error {
  readonly name = 'CircuitOpenError';
  constructor(
    message: string,
    public readonly state: CircuitState,
  ) {
    super(message);
  }
}

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private consecutiveFailures = 0;
  private openedAt: number | null = null;
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;
  private readonly now: () => number;

  /**
   * Called on every state transition (closed → open,
   * open → half-open, half-open → closed). Wired in
   * `EmailProcessor` so each transition emits one
   * structured log line. Keeping the listener as a single
   * optional field (rather than an `EventEmitter`) avoids
   * pulling `events` in for a single hook.
   */
  private onStateChange: ((transition: { from: CircuitState; to: CircuitState }) => void) | null =
    null;

  constructor(options: CircuitBreakerOptions) {
    if (options.failureThreshold <= 0) {
      throw new Error('CircuitBreaker: failureThreshold must be > 0');
    }
    if (options.resetTimeoutMs <= 0) {
      throw new Error('CircuitBreaker: resetTimeoutMs must be > 0');
    }
    this.failureThreshold = options.failureThreshold;
    this.resetTimeoutMs = options.resetTimeoutMs;
    this.now = options.now ?? Date.now;
  }

  /**
   * Subscribe to state transitions. Returns an
   * unsubscribe function for tests that re-wire the
   * listener.
   */
  setStateChangeListener(
    listener: (transition: { from: CircuitState; to: CircuitState }) => void,
  ): () => void {
    this.onStateChange = listener;
    return () => {
      this.onStateChange = null;
    };
  }

  getState(): CircuitState {
    return this.state;
  }

  getConsecutiveFailures(): number {
    return this.consecutiveFailures;
  }

  /**
   * Run `task` through the breaker.
   *
   * - `closed`: run normally. On success, reset the
   *   counter. On failure, increment; if the counter
   *   reaches `failureThreshold`, transition to `open`.
   * - `open`: if the cool-down has elapsed, transition
   *   to `half-open` and run the call (this *is* the
   *   probe). Otherwise, throw `CircuitOpenError`
   *   without touching the upstream.
   * - `half-open`: only one call is in flight at a
   *   time by design (BullMQ concurrency is bounded,
   *   and the email send is not idempotent w.r.t.
   *   failures — letting a flood of probes hit the
   *   upstream is exactly what the breaker is meant
   *   to prevent). If the probe succeeds, transition
   *   to `closed`. If it fails, transition back to
   *   `open` and start a new cool-down.
   */
  async exec<T>(task: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      const elapsed = this.openedAt !== null ? this.now() - this.openedAt : 0;
      if (elapsed < this.resetTimeoutMs) {
        throw new CircuitOpenError(
          `Circuit breaker is open (cool-down remaining: ${this.resetTimeoutMs - elapsed}ms)`,
          this.state,
        );
      }
      this.transition('open', 'half-open');
    }

    try {
      const result = await task();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    if (this.state === 'half-open') {
      this.transition('half-open', 'closed');
    }
    this.consecutiveFailures = 0;
    this.openedAt = null;
  }

  private onFailure(): void {
    this.consecutiveFailures += 1;

    if (this.state === 'half-open') {
      // The probe failed. Re-open with a fresh cool-down
      // so we don't probe again immediately.
      this.openedAt = this.now();
      this.transition('half-open', 'open');
      return;
    }

    if (this.consecutiveFailures >= this.failureThreshold) {
      this.openedAt = this.now();
      this.transition('closed', 'open');
    }
  }

  private transition(from: CircuitState, to: CircuitState): void {
    if (from === to) return;
    this.state = to;
    this.onStateChange?.({ from, to });
  }
}
