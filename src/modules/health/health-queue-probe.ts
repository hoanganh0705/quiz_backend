import { Inject, Injectable, Optional } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { EMAIL_QUEUE_TOKENS } from '@/modules/email/email.constants';
import { TOURNAMENT_QUEUE_TOKENS } from '@/modules/tournament/domain/ports';
import type {
  EmailQueueProbeDto,
  QueueProbeDto,
  TournamentQueueProbeDto,
} from './dto/health-status.dto';

interface BullmqClientLike {
  status?: string;
}

interface QueueLike {
  getJobCounts: (
    ...statuses: Array<'waiting' | 'active' | 'delayed' | 'failed' | 'stalled'>
  ) => Promise<Record<string, number>>;
  client?: BullmqClientLike;
}

const EMPTY_QUEUE_PROBE: QueueProbeDto = Object.freeze({
  depth: 0,
  active: 0,
  waiting: 0,
  delayed: 0,
  failed: 0,
  stalled: 0,
  workerConnected: false,
});

@Injectable()
export class HealthQueueProbe {
  constructor(
    @Inject(EMAIL_QUEUE_TOKENS.QUEUE)
    private readonly emailQueue: QueueLike,
    @Optional()
    @Inject(TOURNAMENT_QUEUE_TOKENS.QUEUE)
    private readonly tournamentQueue?: QueueLike,
    @InjectPinoLogger(HealthQueueProbe.name)
    private readonly logger?: PinoLogger,
  ) {}

  async probeEmailQueue(): Promise<EmailQueueProbeDto> {
    return this.probeQueue(this.emailQueue);
  }

  async probeTournamentQueue(): Promise<TournamentQueueProbeDto> {
    if (!this.tournamentQueue) {
      return { ...EMPTY_QUEUE_PROBE };
    }
    return this.probeQueue(this.tournamentQueue);
  }

  private async probeQueue(queue: QueueLike): Promise<QueueProbeDto> {
    try {
      const counts = await queue.getJobCounts('waiting', 'active', 'delayed', 'failed', 'stalled');
      const waiting = Number(counts.waiting ?? 0);
      const active = Number(counts.active ?? 0);
      const delayed = Number(counts.delayed ?? 0);
      const failed = Number(counts.failed ?? 0);
      const stalled = Number(counts.stalled ?? 0);

      const client = queue.client;
      const workerConnected = client !== undefined && client.status === 'ready';

      return {
        depth: waiting + active + delayed,
        active,
        waiting,
        delayed,
        failed,
        stalled,
        workerConnected,
      };
    } catch (error) {
      this.logger?.warn({
        event: 'health_queue_probe_failed',
        message: error instanceof Error ? error.message : String(error),
      });
      return { ...EMPTY_QUEUE_PROBE };
    }
  }
}
