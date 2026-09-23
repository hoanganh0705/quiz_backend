import { Inject, Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { EMAIL_QUEUE_TOKENS } from '@/modules/email/email.constants';
import type { EmailQueueProbeDto } from './dto/health-status.dto';

interface BullmqClientLike {
  status?: string;
}

@Injectable()
export class HealthQueueProbe {
  constructor(
    @Inject(EMAIL_QUEUE_TOKENS.QUEUE)
    private readonly emailQueue: Queue<unknown>,
  ) {}
  async probeEmailQueue(): Promise<EmailQueueProbeDto> {
    try {
      const counts = await this.emailQueue.getJobCounts('waiting', 'active', 'delayed', 'failed');
      const waiting = Number(counts.waiting ?? 0);
      const active = Number(counts.active ?? 0);
      const delayed = Number(counts.delayed ?? 0);

      const client = this.emailQueue.client as BullmqClientLike | undefined;
      const workerConnected = client !== undefined && client.status === 'ready';

      return {
        depth: waiting + active + delayed,
        workerConnected,
      };
    } catch {
      return { depth: 0, workerConnected: false };
    }
  }
}
