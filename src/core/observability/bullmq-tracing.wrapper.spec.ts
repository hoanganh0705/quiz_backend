/**
 * Phase 5 #1 — BullMQ tracing wrapper unit tests.
 *
 * Verifies:
 *   - `wrapQueueAdd` emits a producer span with the destination
 *     and operation attributes.
 *   - The producer span's trace id is written to the job data.
 *   - `wrapWorkerProcess` emits a consumer span with the producer
 *     span as parent (when present).
 */

import { TracingProvider, type Span } from './tracing.provider';
import {
  BullmqTracingWrapper,
  JOB_TRACE_ID_FIELD,
  JOB_TRACE_SPAN_FIELD,
} from './bullmq-tracing.wrapper';

const spansSeen: Span[] = [];

class CaptureTracing extends TracingProvider {
  constructor() {
    super({} as never);
  }
  flush(): void {
    spansSeen.push(...this.completedSpans.splice(0, this.completedSpans.length));
  }
}

describe('BullmqTracingWrapper', () => {
  let tracing: CaptureTracing;
  let wrapper: BullmqTracingWrapper;

  beforeEach(() => {
    spansSeen.length = 0;
    tracing = new CaptureTracing();
    wrapper = new BullmqTracingWrapper(tracing as never);
  });

  it('wrapQueueAdd emits a producer span and writes the trace id to the job data', async () => {
    const queue = {
      name: 'email-queue',
      add: jest.fn(async () => ({
        id: 'job-1',
        data: {},
        updateData: jest.fn(async (d: Record<string, unknown>) => {
          (queue.add as jest.Mock).mock.results[0].value.data = d;
        }),
      })),
    };
    const addFn = wrapper.wrapQueueAdd(queue as never, 'send-welcome');
    await addFn({ to: 'a@b.c' });

    tracing['flush']();
    expect(spansSeen).toHaveLength(1);
    expect(spansSeen[0].kind).toBe('producer');
    expect(spansSeen[0].attributes['messaging.destination']).toBe('email-queue');
    expect(spansSeen[0].attributes['messaging.operation']).toBe('send-welcome');

    const data = (queue.add.mock.results[0].value as { data: Record<string, unknown> }).data;
    expect(data[JOB_TRACE_ID_FIELD]).toBe(spansSeen[0].traceId);
    expect(data[JOB_TRACE_SPAN_FIELD]).toBe(spansSeen[0].spanId);
  });

  it('wrapWorkerProcess emits a consumer span with the producer as parent', async () => {
    const handler = jest.fn(async () => undefined);
    const wrapped = wrapper.wrapWorkerProcess(
      { name: 'email-queue' } as never,
      handler,
    );

    const traceId = '0af7651916cd43dd8448eb211c80319c';
    const spanId = 'b7ad6b7169203331';
    await wrapped({
      id: 'job-1',
      name: 'send-welcome',
      data: {
        [JOB_TRACE_ID_FIELD]: traceId,
        [JOB_TRACE_SPAN_FIELD]: spanId,
        to: 'a@b.c',
      },
    } as never);

    tracing['flush']();
    expect(spansSeen).toHaveLength(1);
    expect(spansSeen[0].kind).toBe('consumer');
    expect(spansSeen[0].parentSpanId).toBe(spanId);
    expect(spansSeen[0].traceId).toBe(traceId);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('wrapWorkerProcess works without a parent when job data lacks the trace id', async () => {
    const handler = jest.fn(async () => undefined);
    const wrapped = wrapper.wrapWorkerProcess(
      { name: 'email-queue' } as never,
      handler,
    );

    await wrapped({ id: 'job-1', name: 'send-welcome', data: { to: 'a@b.c' } } as never);

    tracing['flush']();
    expect(spansSeen).toHaveLength(1);
    expect(spansSeen[0].parentSpanId).toBeUndefined();
  });
});