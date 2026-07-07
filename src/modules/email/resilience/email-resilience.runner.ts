import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  emailConfig,
  type EmailConfig,
} from '@/core/config';
import { CircuitBreaker, type CircuitState } from '@/common/resilience/circuit-breaker';

/**
 * Shared resilience wrapper for outbound email calls.
 *
 * Every email handler wraps its provider call in
 * `runWithResilience(...)`, which:
 *   1. Enforces a hard timeout via `AbortController`.
 *   2. Routes the call through a per-process circuit breaker so a
 *      sustained Resend outage short-circuits subsequent calls
 *      instead of letting them pile up as retry storms.
 *   3. Returns the circuit state to the caller so it can be
 *      included in failure log lines.
 *
 * Handlers stay focused on per-job-type concerns (idempotency,
 * URL building, HTML). The breaker + timeout policy lives here so
 * a single change applies to every handler.
 */
@Injectable()
export class EmailResilienceRunner {
  private readonly sendTimeoutMs: number;
  private readonly resendBreaker: CircuitBreaker;

  constructor(
    @Inject(emailConfig.KEY) private readonly email: EmailConfig,
    @InjectPinoLogger(EmailResilienceRunner.name) private readonly logger: PinoLogger,
  ) {
    this.sendTimeoutMs = email.sendTimeoutMs;
    this.resendBreaker = new CircuitBreaker({
      failureThreshold: email.circuitBreaker.failureThreshold,
      resetTimeoutMs: email.circuitBreaker.resetTimeoutMs,
    });

    // Emit a single structured log line on every circuit state
    // transition. Operators can `grep "email_resend_circuit_state"`
    // to see when the upstream started flapping and when it
    // recovered. Using `from`/`to` (rather than just `state`) makes
    // it possible to distinguish "first failure" (closed → open)
    // from "probe failure" (half-open → open).
    this.resendBreaker.setStateChangeListener(({ from, to }) => {
      this.logger.warn({
        event: 'email_resend_circuit_state',
        from,
        to,
        consecutiveFailures: this.resendBreaker.getConsecutiveFailures(),
      });
    });
  }

  getCircuitState(): CircuitState {
    return this.resendBreaker.getState();
  }

  /**
   * Run `task` with timeout + circuit-breaker protection.
   * `task` receives an `AbortSignal` so it can cancel any
   * outbound HTTP call (e.g. Resend's SDK) when the timeout
   * fires.
   */
  async runWithResilience<T>(
    buildTask: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    const controller = new AbortController();
    return this.withTimeout(
      this.resendBreaker.exec(() => buildTask(controller.signal)),
      this.sendTimeoutMs,
      controller,
    );
  }

  private async withTimeout<T>(
    task: Promise<T>,
    timeoutMs: number,
    controller?: AbortController,
  ): Promise<T> {
    let timer: NodeJS.Timeout | null = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller?.abort();
        reject(new Error(`Email sending timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });
    try {
      return await Promise.race([task, timeoutPromise]);
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }
}
