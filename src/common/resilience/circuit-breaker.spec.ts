/* eslint-disable @typescript-eslint/require-await */
import { CircuitBreaker, CircuitOpenError } from './circuit-breaker';

describe('CircuitBreaker', () => {
  const makeBreaker = (opts?: {
    failureThreshold?: number;
    resetTimeoutMs?: number;
    now?: () => number;
  }) =>
    new CircuitBreaker({
      failureThreshold: opts?.failureThreshold ?? 3,
      resetTimeoutMs: opts?.resetTimeoutMs ?? 1_000,
      now: opts?.now,
    });

  describe('closed state', () => {
    it('passes calls through on success', async () => {
      const breaker = makeBreaker();
      const result = await breaker.exec(async () => 'ok');
      expect(result).toBe('ok');
      expect(breaker.getState()).toBe('closed');
      expect(breaker.getConsecutiveFailures()).toBe(0);
    });

    it('increments the failure counter without opening until threshold is reached', async () => {
      const breaker = makeBreaker({ failureThreshold: 3 });
      await expect(
        breaker.exec(async () => {
          throw new Error('boom');
        }),
      ).rejects.toThrow('boom');
      expect(breaker.getState()).toBe('closed');
      expect(breaker.getConsecutiveFailures()).toBe(1);

      await expect(
        breaker.exec(async () => {
          throw new Error('boom');
        }),
      ).rejects.toThrow('boom');
      expect(breaker.getState()).toBe('closed');
      expect(breaker.getConsecutiveFailures()).toBe(2);
    });

    it('opens the breaker once consecutive failures reach the threshold', async () => {
      const breaker = makeBreaker({ failureThreshold: 2 });
      await expect(
        breaker.exec(async () => {
          throw new Error('boom');
        }),
      ).rejects.toThrow('boom');
      await expect(
        breaker.exec(async () => {
          throw new Error('boom');
        }),
      ).rejects.toThrow('boom');
      expect(breaker.getState()).toBe('open');
    });

    it('resets the consecutive-failure counter after a success', async () => {
      const breaker = makeBreaker({ failureThreshold: 3 });
      await expect(
        breaker.exec(async () => {
          throw new Error('boom');
        }),
      ).rejects.toThrow();
      await expect(
        breaker.exec(async () => {
          throw new Error('boom');
        }),
      ).rejects.toThrow();
      await breaker.exec(async () => 'ok');
      expect(breaker.getConsecutiveFailures()).toBe(0);

      await expect(
        breaker.exec(async () => {
          throw new Error('boom');
        }),
      ).rejects.toThrow();
      expect(breaker.getState()).toBe('closed');
      expect(breaker.getConsecutiveFailures()).toBe(1);
    });
  });

  describe('open state', () => {
    const openBreaker = async (
      threshold: number,
      resetTimeoutMs: number,
    ): Promise<CircuitBreaker> => {
      const breaker = new CircuitBreaker({
        failureThreshold: threshold,
        resetTimeoutMs,
        now: () => 0,
      });
      for (let i = 0; i < threshold; i += 1) {
        await expect(
          breaker.exec(async () => {
            throw new Error('boom');
          }),
        ).rejects.toThrow();
      }
      expect(breaker.getState()).toBe('open');
      return breaker;
    };

    it('short-circuits calls during the cool-down with CircuitOpenError', async () => {
      const breaker = await openBreaker(2, 1_000);
      await expect(breaker.exec(async () => 'ok')).rejects.toBeInstanceOf(CircuitOpenError);
    });

    it('transitions to half-open after the cool-down elapses', async () => {
      let now = 0;
      const breaker = new CircuitBreaker({
        failureThreshold: 2,
        resetTimeoutMs: 1_000,
        now: () => now,
      });
      for (let i = 0; i < 2; i += 1) {
        await expect(
          breaker.exec(async () => {
            throw new Error('boom');
          }),
        ).rejects.toThrow();
      }
      now = 1_500;
      const task = jest.fn(async () => 'recovered');
      const result = await breaker.exec(task);
      expect(result).toBe('recovered');
      expect(breaker.getState()).toBe('closed');
      expect(breaker.getConsecutiveFailures()).toBe(0);
    });

    it('re-opens with a fresh cool-down if the half-open probe fails', async () => {
      let now = 0;
      const breaker = new CircuitBreaker({
        failureThreshold: 2,
        resetTimeoutMs: 1_000,
        now: () => now,
      });
      for (let i = 0; i < 2; i += 1) {
        await expect(
          breaker.exec(async () => {
            throw new Error('boom');
          }),
        ).rejects.toThrow();
      }
      now = 1_500;
      await expect(
        breaker.exec(async () => {
          throw new Error('still broken');
        }),
      ).rejects.toThrow();
      expect(breaker.getState()).toBe('open');
    });
  });

  describe('state-change listener', () => {
    it('fires on every transition with from/to information', async () => {
      let now = 0;
      const breaker = new CircuitBreaker({
        failureThreshold: 1,
        resetTimeoutMs: 100,
        now: () => now,
      });
      const transitions: Array<{ from: string; to: string }> = [];
      breaker.setStateChangeListener((t) => transitions.push(t));

      await expect(
        breaker.exec(async () => {
          throw new Error('boom');
        }),
      ).rejects.toThrow();
      expect(transitions).toEqual([{ from: 'closed', to: 'open' }]);

      await expect(breaker.exec(async () => 'ok')).rejects.toBeInstanceOf(CircuitOpenError);

      now = 1_000_000;
      const closedListener = jest.fn();
      breaker.setStateChangeListener(closedListener);
      await breaker.exec(async () => 'ok');
      expect(closedListener).toHaveBeenCalledWith({ from: 'open', to: 'half-open' });
      expect(closedListener).toHaveBeenCalledWith({ from: 'half-open', to: 'closed' });
    });

    it('returns an unsubscribe function from setStateChangeListener', () => {
      const breaker = makeBreaker();
      const listener = jest.fn();
      const unsubscribe = breaker.setStateChangeListener(listener);
      unsubscribe();
      expect(breaker['onStateChange']).toBeNull();
    });
  });

  describe('constructor validation', () => {
    it('rejects a non-positive failureThreshold', () => {
      expect(() => new CircuitBreaker({ failureThreshold: 0, resetTimeoutMs: 1_000 })).toThrow(
        /failureThreshold/,
      );
    });

    it('rejects a non-positive resetTimeoutMs', () => {
      expect(() => new CircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 0 })).toThrow(
        /resetTimeoutMs/,
      );
    });
  });
});
