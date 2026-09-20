import { Injectable, Logger } from '@nestjs/common';
import {
  CircuitBreaker,
  CircuitOpenError,
  type CircuitState,
} from '@/common/resilience/circuit-breaker';

export type RedisCircuitMetrics = {
  state: CircuitState;
  consecutiveFailures: number;
  shortCircuitedCount: number;
};

export type RedisCircuitBreakerOptions = {
  failureThreshold: number;
  resetTimeoutMs: number;
  now?: () => number;
};

@Injectable()
export class RedisCircuitBreaker {
  private readonly breaker: CircuitBreaker;
  private readonly logger = new Logger(RedisCircuitBreaker.name);
  private shortCircuitedCount = 0;

  constructor(options: RedisCircuitBreakerOptions) {
    if (options.failureThreshold <= 0) {
      throw new Error('RedisCircuitBreaker: failureThreshold must be > 0');
    }
    if (options.resetTimeoutMs <= 0) {
      throw new Error('RedisCircuitBreaker: resetTimeoutMs must be > 0');
    }
    this.breaker = new CircuitBreaker({
      failureThreshold: options.failureThreshold,
      resetTimeoutMs: options.resetTimeoutMs,
      now: options.now,
    });

    this.breaker.setStateChangeListener(({ from, to }) => {
      this.logger.warn({
        event: 'redis_circuit_state',
        from,
        to,
        consecutiveFailures: this.breaker.getConsecutiveFailures(),
      });
    });
  }

  getState(): CircuitState {
    return this.breaker.getState();
  }

  getConsecutiveFailures(): number {
    return this.breaker.getConsecutiveFailures();
  }

  getShortCircuitedCount(): number {
    return this.shortCircuitedCount;
  }

  getMetrics(): RedisCircuitMetrics {
    return {
      state: this.breaker.getState(),
      consecutiveFailures: this.breaker.getConsecutiveFailures(),
      shortCircuitedCount: this.shortCircuitedCount,
    };
  }

  setStateChangeListener(
    listener: (transition: { from: CircuitState; to: CircuitState }) => void,
  ): () => void {
    return this.breaker.setStateChangeListener(listener);
  }

  async exec<T>(fallback: T, task: () => Promise<T>): Promise<T> {
    try {
      return await this.breaker.exec(task);
    } catch (error) {
      if (error instanceof CircuitOpenError) {
        this.shortCircuitedCount += 1;
        this.logger.warn({
          event: 'redis_circuit_short_circuited',
          state: error.state,
          shortCircuitedCount: this.shortCircuitedCount,
        });
        return fallback;
      }
      throw error;
    }
  }
}

export const REDIS_CIRCUIT_BREAKER = Symbol('REDIS_CIRCUIT_BREAKER');
