import { SecurityService } from './security.service';
import { CircuitOpenError } from '@/common/resilience/circuit-breaker';
import { RateLimitExceededError } from './errors';

class FakeLogger {
  readonly info = jest.fn();
  readonly warn = jest.fn();
  readonly error = jest.fn();
  readonly debug = jest.fn();
}

interface CacheFake {
  incrementWindowCounter: jest.Mock;
  setIfNotExistsWithTtlSeconds: jest.Mock;
  incrementCounterWithInitialTtlSeconds: jest.Mock;
}

function makeCache(): CacheFake {
  return {
    incrementWindowCounter: jest.fn().mockResolvedValue(0),
    setIfNotExistsWithTtlSeconds: jest.fn().mockResolvedValue(true),
    incrementCounterWithInitialTtlSeconds: jest.fn().mockResolvedValue(1),
  };
}

interface MetricsFake {
  incAuthRateLimiterFailOpen: jest.Mock;
}

function makeMetrics(): MetricsFake {
  return {
    incAuthRateLimiterFailOpen: jest.fn(),
  };
}

function makeService(opts: { cache?: CacheFake; metrics?: MetricsFake } = {}) {
  const cache = opts.cache ?? makeCache();
  const metrics = opts.metrics ?? makeMetrics();
  const logger = new FakeLogger();
  const sessionService = {} as never;
  const service = new SecurityService(
    {} as never,
    {} as never,
    cache as never,
    sessionService,
    metrics as never,
    logger as unknown as never,
  );
  return { service, cache, metrics, logger };
}

const baseContext = { ipAddress: '10.0.0.1' } as never;

describe('SecurityService.enforceLoginRateLimit — fail-mode policy', () => {
  it('login_user throws RateLimitExceededError when the Redis circuit is open', async () => {
    const cache = makeCache();
    let callCount = 0;
    cache.incrementWindowCounter.mockImplementation(async () => {
      callCount += 1;
      if (callCount === 1) {
        // login_ip — fail open, returns successfully.
        throw new CircuitOpenError('redis open', 'open');
      }
      // login_user — fail closed.
      throw new CircuitOpenError('redis open', 'open');
    });
    const { service, metrics } = makeService({ cache });

    await expect(service.enforceLoginRateLimit(baseContext, 'user-1')).rejects.toBeInstanceOf(
      RateLimitExceededError,
    );

    expect(metrics.incAuthRateLimiterFailOpen).toHaveBeenCalledWith('login_ip');
  });

  it('login_ip lets the request proceed and increments the fail-open metric', async () => {
    const cache = makeCache();
    cache.incrementWindowCounter.mockImplementation(async () => {
      throw new CircuitOpenError('redis open', 'open');
    });
    const { service, metrics, logger } = makeService({ cache });

    await expect(service.enforceLoginRateLimit(baseContext)).resolves.toBeUndefined();

    expect(metrics.incAuthRateLimiterFailOpen).toHaveBeenCalledWith('login_ip');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'auth_rate_limit_fail_open', bucket: 'login_ip' }),
    );
  });

  it('login_user re-throws other (non-circuit) errors unchanged', async () => {
    const cache = makeCache();
    cache.incrementWindowCounter.mockImplementation(async () => {
      throw new Error('redis down');
    });
    const { service } = makeService({ cache });

    await expect(service.enforceLoginRateLimit(baseContext, 'user-1')).rejects.toThrow(
      'redis down',
    );
  });
});

describe('SecurityService.enforceRefreshRateLimit — fail-mode policy', () => {
  it('refresh_user throws RateLimitExceededError when the Redis circuit is open', async () => {
    const cache = makeCache();
    let callCount = 0;
    cache.incrementWindowCounter.mockImplementation(async () => {
      callCount += 1;
      if (callCount === 1) {
        // refresh_ip — fail open, returns successfully.
        throw new CircuitOpenError('redis open', 'open');
      }
      // refresh_user — fail closed.
      throw new CircuitOpenError('redis open', 'open');
    });
    const { service, metrics } = makeService({ cache });

    await expect(service.enforceRefreshRateLimit(baseContext, 'user-1')).rejects.toBeInstanceOf(
      RateLimitExceededError,
    );

    expect(metrics.incAuthRateLimiterFailOpen).toHaveBeenCalledWith('refresh_ip');
  });

  it('refresh_ip lets the request proceed and increments the fail-open metric', async () => {
    const cache = makeCache();
    let callCount = 0;
    cache.incrementWindowCounter.mockImplementation(async () => {
      callCount += 1;
      if (callCount === 1) {
        // First call (refresh_ip) — fail open.
        throw new CircuitOpenError('redis open', 'open');
      }
      // Second call (refresh_user) succeeds.
      return 1;
    });
    const { service, metrics } = makeService({ cache });

    await expect(service.enforceRefreshRateLimit(baseContext, 'user-1')).resolves.toBeUndefined();

    expect(metrics.incAuthRateLimiterFailOpen).toHaveBeenCalledWith('refresh_ip');
  });
});

describe('SecurityService.enforceLoginRateLimit — happy path', () => {
  it('increments both IP and user buckets and does not increment metrics', async () => {
    const cache = makeCache();
    cache.incrementWindowCounter.mockResolvedValue(1);
    const { service, metrics } = makeService({ cache });

    await expect(service.enforceLoginRateLimit(baseContext, 'user-1')).resolves.toBeUndefined();

    expect(cache.incrementWindowCounter).toHaveBeenCalledTimes(2);
    expect(metrics.incAuthRateLimiterFailOpen).not.toHaveBeenCalled();
  });

  it('throws RateLimitExceededError when the counter exceeds the limit', async () => {
    const cache = makeCache();
    cache.incrementWindowCounter.mockResolvedValue(99);
    const { service } = makeService({ cache });

    await expect(service.enforceLoginRateLimit(baseContext, 'user-1')).rejects.toBeInstanceOf(
      RateLimitExceededError,
    );
  });
});
