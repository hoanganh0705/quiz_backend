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
          const job = await (originalAdd as (...a: unknown[]) => Promise<Job<T>>)(...args);
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
              traceId: data[JOB_TRACE_ID_FIELD],
              spanId: data[JOB_TRACE_SPAN_FIELD],
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
