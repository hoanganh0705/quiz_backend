import { HealthQueueProbe } from './health-queue-probe';
import type { EmailQueueProbeDto, TournamentQueueProbeDto } from './dto/health-status.dto';

interface FakeQueue {
  getJobCounts: jest.Mock;
  client?: { status?: string };
}

function buildProbe(emailQueue: FakeQueue, tournamentQueue?: FakeQueue): HealthQueueProbe {
  if (tournamentQueue !== undefined) {
    return new HealthQueueProbe(emailQueue, tournamentQueue);
  }
  return new HealthQueueProbe(emailQueue);
}

describe('HealthQueueProbe.emailQueue', () => {
  it('sums waiting/active/delayed counts and reports worker connectivity', async () => {
    const queue: FakeQueue = {
      getJobCounts: jest.fn().mockResolvedValue({
        waiting: 4,
        active: 2,
        delayed: 1,
        failed: 7,
        stalled: 3,
      }),
      client: { status: 'ready' },
    };
    const probe = buildProbe(queue);

    const result: EmailQueueProbeDto = await probe.probeEmailQueue();

    expect(result).toEqual({
      depth: 7,
      active: 2,
      waiting: 4,
      delayed: 1,
      failed: 7,
      stalled: 3,
      workerConnected: true,
    });
  });

  it('coerces missing counts to zero', async () => {
    const queue: FakeQueue = {
      getJobCounts: jest.fn().mockResolvedValue({}),
      client: { status: 'ready' },
    };
    const probe = buildProbe(queue);

    const result = await probe.probeEmailQueue();

    expect(result.depth).toBe(0);
    expect(result.active).toBe(0);
    expect(result.waiting).toBe(0);
    expect(result.delayed).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.stalled).toBe(0);
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

    expect(result).toEqual({
      depth: 0,
      active: 0,
      waiting: 0,
      delayed: 0,
      failed: 0,
      stalled: 0,
      workerConnected: false,
    });
  });
});

describe('HealthQueueProbe.tournamentQueue', () => {
  it('surfaces depth and stalled counts when the tournament queue is wired in', async () => {
    const emailQueue: FakeQueue = {
      getJobCounts: jest.fn().mockResolvedValue({ waiting: 0, active: 0, delayed: 0 }),
    };
    const tournamentQueue: FakeQueue = {
      getJobCounts: jest.fn().mockResolvedValue({
        waiting: 2,
        active: 1,
        delayed: 0,
        failed: 0,
        stalled: 4,
      }),
      client: { status: 'ready' },
    };
    const probe = buildProbe(emailQueue, tournamentQueue);

    const result: TournamentQueueProbeDto = await probe.probeTournamentQueue();

    expect(result).toEqual({
      depth: 3,
      active: 1,
      waiting: 2,
      delayed: 0,
      failed: 0,
      stalled: 4,
      workerConnected: true,
    });
  });

  it('returns a zero probe when the tournament queue is not provided', async () => {
    const emailQueue: FakeQueue = {
      getJobCounts: jest.fn().mockResolvedValue({ waiting: 0, active: 0, delayed: 0 }),
    };
    const probe = buildProbe(emailQueue);

    const result: TournamentQueueProbeDto = await probe.probeTournamentQueue();

    expect(result).toEqual({
      depth: 0,
      active: 0,
      waiting: 0,
      delayed: 0,
      failed: 0,
      stalled: 0,
      workerConnected: false,
    });
  });
});
