/**
 * Phase 5 #1 — BullMQ job tracing.
 *
 * Wraps the email-queue worker so each processed job emits a
 * `consumer` span and each enqueued job emits a `producer` span.
 * The trace is linked via the `x-trace-id` job data field — the
 * `producer` span writes the `traceId` to the job data, and the
 * `consumer` reads it back so the spans share a trace id.
 *
 * Why link via job data instead of `traceparent`?
 * -----------------------------------------------
 * BullMQ serialises job data through Redis, so a header-style
 * `traceparent` would have to be re-injected at job boundaries.
 * Embedding the `traceId` directly in job data is simpler and
 * survives the Redis round-trip without further coordination.
 */

import { Inject, Injectable } from '@nestjs/common';
import { Job, Queue, Worker } from 'bullmq';
import {
  TRACING_PROVIDER,
  type SpanContext,
  type TracingProvider,
} from '@/core/observability/tracing.provider';

export const JOB_TRACE_ID_FIELD = '__traceId';

@Injectable()
export class BullmqTracingWrapper {
  constructor(
    @Inject(TRACING_PROVIDER)
    private readonly tracing: TracingProvider,
  ) {}

  /**
   * Wrap a Queue's `add` so the producer span's `traceId` is
   * written into the job data and used by the worker span on the
   * consumer side.
   */
  wrapQueueAdd<T>(queue: Queue<T>, name: string): (...args: unknown[]) => Promise<Job<T>> {
    const originalAdd = queue.add.bind(queue) as Queue<T>['add'];
    return async (...args: Parameters<Queue<T>['add']>) => {
      return this.tracing.withSpan(
        `bullmq.add ${queue.name}.${name}`,
        {
          kind: 'producer',
          attributes: {
            'messaging.system': 'bullmq',
            'messaging.destination': queue.name,
            'messaging.operation': name,
          },
        },
        async (span) => {
          const job = (await (originalAdd as (...a: unknown[]) => Promise<Job<T>>)(...args)) as Job<T>;
          span.attributes['messaging.message_id'] = job.id ?? '';
          // Embed the trace id in the job data so the consumer
          // can attach to the same trace.
          await job.updateData({
            ...((job.data as Record<string, unknown> | undefined) ?? {}),
            [JOB_TRACE_ID_FIELD]: span.traceId,
            [JOB_TRACE_SPAN_FIELD]: span.spanId,
          } as unknown as Parameters<Job<T>['updateData']>[0]);
          return job;
        },
      );
    };
  }

  /**
   * Wrap a Worker's `process` so the consumer span is opened
   * with the producer's trace id as parent (when present).
   */
  wrapWorkerProcess<T>(
    worker: Worker<T>,
    handler: (job: Job<T>) => Promise<unknown>,
  ): (job: Job<T>) => Promise<unknown> {
    return async (job: Job<T>) => {
      const data = (job.data as Record<string, unknown> | undefined) ?? {};
      const parent: SpanContext | undefined =
        typeof data[JOB_TRACE_ID_FIELD] === 'string' &&
        typeof data[JOB_TRACE_SPAN_FIELD] === 'string'
          ? {
              traceId: data[JOB_TRACE_ID_FIELD] as string,
              spanId: data[JOB_TRACE_SPAN_FIELD] as string,
            }
          : undefined;

      return this.tracing.withSpan(
        `bullmq.process ${worker.name}`,
        {
          kind: 'consumer',
          parent,
          attributes: {
            'messaging.system': 'bullmq',
            'messaging.destination': worker.name,
            'messaging.operation': job.name,
            'messaging.message_id': job.id ?? '',
          },
        },
        () => handler(job),
      );
    };
  }
}

export const JOB_TRACE_SPAN_FIELD = '__parentSpanId';