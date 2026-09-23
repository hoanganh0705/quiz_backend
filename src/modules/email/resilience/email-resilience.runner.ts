import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { emailConfig, type EmailConfig } from '@/core/config';
import { CircuitBreaker, type CircuitState } from '@/common/resilience/circuit-breaker';

@Injectable()
export class EmailResilienceRunner implements OnModuleInit {
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
  }

  onModuleInit(): void {
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

  async runWithResilience<T>(buildTask: (signal: AbortSignal) => Promise<T>): Promise<T> {
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
    controller: AbortController,
  ): Promise<T> {
    let timer: NodeJS.Timeout | null = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
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
