import { HealthQueueProbe } from './health-queue-probe';
import type { EmailQueueProbeDto } from './dto/health-status.dto';

interface FakeQueue {
  getJobCounts: jest.Mock;
  client?: { status?: string };
}

function buildProbe(queue: FakeQueue): HealthQueueProbe {
  return new HealthQueueProbe(queue as never);
}

describe('HealthQueueProbe', () => {
  it('sums waiting/active/delayed counts and reports worker connectivity', async () => {
    const queue: FakeQueue = {
      getJobCounts: jest.fn().mockResolvedValue({
        waiting: 4,
        active: 2,
        delayed: 1,
        failed: 7,
      }),
      client: { status: 'ready' },
    };
    const probe = buildProbe(queue);

    const result: EmailQueueProbeDto = await probe.probeEmailQueue();

    expect(result).toEqual({ depth: 7, workerConnected: true });
  });

  it('coerces missing counts to zero', async () => {
    const queue: FakeQueue = {
      getJobCounts: jest.fn().mockResolvedValue({}),
      client: { status: 'ready' },
    };
    const probe = buildProbe(queue);

    const result = await probe.probeEmailQueue();

    expect(result.depth).toBe(0);
  });

  it('reports workerConnected=false when client is undefined', async () => {
    const queue: FakeQueue = {
      getJobCounts: jest.fn().mockResolvedValue({ waiting: 0, active: 0, delayed: 0 }),
    };
    const probe = buildProbe(queue);

    const result = await probe.probeEmailQueue();

    expect(result.workerConnected).toBe(false);
  });

  it('reports workerConnected=false when client status is not ready', async () => {
    const queue: FakeQueue = {
      getJobCounts: jest.fn().mockResolvedValue({ waiting: 0, active: 0, delayed: 0 }),
      client: { status: 'connecting' },
    };
    const probe = buildProbe(queue);

    const result = await probe.probeEmailQueue();

    expect(result.workerConnected).toBe(false);
  });

  it('returns a safe fallback when getJobCounts throws', async () => {
    const queue: FakeQueue = {
      getJobCounts: jest.fn().mockRejectedValue(new Error('redis offline')),
    };
    const probe = buildProbe(queue);

    const result = await probe.probeEmailQueue();

    expect(result).toEqual({ depth: 0, workerConnected: false });
  });
});
