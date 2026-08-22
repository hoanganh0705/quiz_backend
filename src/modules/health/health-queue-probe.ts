/**
 * Per-queue health probe.
 *
 * Phase 2 #3 — surfaces BullMQ queue depth and worker connection
 * state to the health endpoint. The probe is intentionally
 * read-only: it never enqueues, fails, or drains jobs. The depth
 * figure is `waiting + active + delayed` so a backed-up queue is
 * visible as growing depth even when workers are still running.
 *
 * Why a separate service?
 * -----------------------
 * `EmailService` already has the BullMQ `Queue` injected, but the
 * queue is intentionally exposed as a `Symbol` token to avoid
 * leaking the BullMQ type up the dependency graph. The probe
 * service is the only consumer that needs the queue for non-
 * enqueue purposes, so we wire it here and let the health module
 * depend on this module instead of on `EmailService` directly.
 */

import { Inject, Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { EMAIL_QUEUE_TOKENS } from '@/modules/email/email.constants';
import type { EmailQueueProbeDto } from './dto/health-status.dto';

@Injectable()
export class HealthQueueProbe {
  constructor(
    @Inject(EMAIL_QUEUE_TOKENS.QUEUE)
    private readonly emailQueue: Queue<unknown>,
  ) {}

  /**
   * Read the current queue depth + worker connectivity.
   * Returns `{ depth: 0, workerConnected: false }` on any error
   * so the health endpoint can surface `degraded` without
   * cascading the failure.
   */
  async probeEmailQueue(): Promise<EmailQueueProbeDto> {
    try {
      // `getJobCounts` returns `{ waiting, active, completed, failed,
      // delayed }`. We sum the three "in-flight" buckets.
      const counts = await this.emailQueue.getJobCounts(
        'waiting',
        'active',
        'delayed',
        'failed',
      );
      const waiting = Number(counts.waiting ?? 0);
      const active = Number(counts.active ?? 0);
      const delayed = Number(counts.delayed ?? 0);

      // The worker is connected iff the queue is reachable AND a
      // consumer is registered. BullMQ exposes the consumer set
      // via `getWorkers()` only on some setups; the safest signal
      // is `client.status` (the ioredis client state). Anything
      // other than `ready` is treated as "not connected".
      const workerConnected =
        this.emailQueue.client !== undefined &&
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (this.emailQueue.client as any)?.status === 'ready';

      return {
        depth: waiting + active + delayed,
        workerConnected,
      };
    } catch {
      return { depth: 0, workerConnected: false };
    }
  }
}