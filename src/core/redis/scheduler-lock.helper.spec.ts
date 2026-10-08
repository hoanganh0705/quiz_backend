import { acquireSchedulerLockOrRecordSkip } from './scheduler-lock.helper';

const makeCache = (lockToken: string | null) => ({
  acquireAdvisoryLock: jest.fn().mockResolvedValue(lockToken),
  releaseAdvisoryLock: jest.fn().mockResolvedValue(true),
});

const makeCircuit = (state: 'closed' | 'open' | 'half_open') => ({
  getCircuitState: jest.fn().mockReturnValue(state),
});

const makeMetrics = () => ({
  incSchedulerSkipped: jest.fn(),
});

describe('acquireSchedulerLockOrRecordSkip', () => {
  it('returns the lock token when acquired and does not touch the metric', async () => {
    const cache = makeCache('token-1');
    const circuit = makeCircuit('closed');
    const metrics = makeMetrics();

    const result = await acquireSchedulerLockOrRecordSkip({
      cache: cache as never,
      circuit: circuit,
      metrics: metrics as never,
      lockKey: 'x',
      lockTtlMs: 60_000,
      job: 'unit-test-job',
    });

    expect(result.acquired).toBe(true);
    if (result.acquired) expect(result.token).toBe('token-1');
    expect(metrics.incSchedulerSkipped).not.toHaveBeenCalled();
  });

  it('does not record a metric skip when the lock is held by another replica (circuit closed)', async () => {
    const cache = makeCache(null);
    const circuit = makeCircuit('closed');
    const metrics = makeMetrics();

    const result = await acquireSchedulerLockOrRecordSkip({
      cache: cache as never,
      circuit: circuit,
      metrics: metrics as never,
      lockKey: 'x',
      lockTtlMs: 60_000,
      job: 'unit-test-job',
    });

    expect(result.acquired).toBe(false);
    if (!result.acquired) expect(result.reason).toBe('held');
    expect(metrics.incSchedulerSkipped).not.toHaveBeenCalled();
  });

  it('records a scheduler-skipped metric when the circuit is open', async () => {
    const cache = makeCache(null);
    const circuit = makeCircuit('open');
    const metrics = makeMetrics();

    const result = await acquireSchedulerLockOrRecordSkip({
      cache: cache as never,
      circuit: circuit,
      metrics: metrics as never,
      lockKey: 'x',
      lockTtlMs: 60_000,
      job: 'unit-test-job',
    });

    expect(result.acquired).toBe(false);
    if (!result.acquired) expect(result.reason).toBe('circuit_open');
    expect(metrics.incSchedulerSkipped).toHaveBeenCalledWith('unit-test-job');
  });

  it('does not record a metric when the circuit is half-open', async () => {
    const cache = makeCache(null);
    const circuit = makeCircuit('half_open');
    const metrics = makeMetrics();

    const result = await acquireSchedulerLockOrRecordSkip({
      cache: cache as never,
      circuit: circuit,
      metrics: metrics as never,
      lockKey: 'x',
      lockTtlMs: 60_000,
      job: 'unit-test-job',
    });

    expect(result.acquired).toBe(false);
    if (!result.acquired) expect(result.reason).toBe('held');
    expect(metrics.incSchedulerSkipped).not.toHaveBeenCalled();
  });

  it('tolerates a missing metrics registry', async () => {
    const cache = makeCache(null);
    const circuit = makeCircuit('open');

    const result = await acquireSchedulerLockOrRecordSkip({
      cache: cache as never,
      circuit: circuit,
      metrics: undefined,
      lockKey: 'x',
      lockTtlMs: 60_000,
      job: 'unit-test-job',
    });

    expect(result.acquired).toBe(false);
  });
});
