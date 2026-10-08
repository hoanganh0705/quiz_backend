/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return */
import {
  ReviewOutboxPayloadError,
  ReviewOutboxProcessorService,
} from './review-outbox-processor.service';
import type { ReviewDomainEventBusPort } from '@/modules/review/domain/events';

function makeLogger(): any {
  return { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() };
}

function makeChainWithSkipLocked(rows: ReadonlyArray<Record<string, unknown>>): any {
  const self: any = {
    from: jest.fn(),
    where: jest.fn(),
    orderBy: jest.fn(),
    limit: jest.fn(),
    for: jest.fn(),
  };
  self.from.mockReturnValue(self);
  self.where.mockReturnValue(self);
  self.orderBy.mockReturnValue(self);
  self.limit.mockReturnValue(self);
  self.for.mockResolvedValue(rows);
  return self;
}

function makeChainPlain(rows: ReadonlyArray<Record<string, unknown>>): any {
  const self: any = {
    from: jest.fn(),
    where: jest.fn(),
    orderBy: jest.fn(),
    limit: jest.fn(),
  };
  self.from.mockReturnValue(self);
  self.where.mockReturnValue(self);
  self.orderBy.mockReturnValue(self);
  self.limit.mockResolvedValue(rows);
  return self;
}

function makeDbHandle(
  pendingRows: ReadonlyArray<Record<string, unknown>>,
  dlqRows: ReadonlyArray<Record<string, unknown>> = [],
): any {
  const pendingChain = makeChainWithSkipLocked(pendingRows);
  const dlqChain = makeChainPlain(dlqRows);

  const handle: any = {};
  handle.select = jest.fn((cols: unknown) => {
    const hasDlqReason =
      typeof cols === 'object' && cols !== null && Object.keys(cols).includes('dlqReason');
    return hasDlqReason ? dlqChain : pendingChain;
  });
  handle.update = jest.fn().mockReturnValue({
    set: jest.fn().mockReturnValue({ where: jest.fn().mockReturnThis() }),
  });
  return handle;
}

function makeProcessor(opts: {
  rows: ReadonlyArray<Record<string, unknown>>;
  reviewEventBus: { dispatchStrict: jest.Mock };
}): ReviewOutboxProcessorService {
  const db = makeDbHandle(opts.rows);
  return new ReviewOutboxProcessorService(
    db,
    opts.reviewEventBus as unknown as ReviewDomainEventBusPort,
    makeLogger(),
  );
}

describe('ReviewOutboxProcessorService (bus-driven dispatch)', () => {
  it('publishes a ReviewSubmittedEvent to the in-process bus instead of calling QuizAnalyticsService directly', async () => {
    const dispatchStrict = jest.fn().mockResolvedValue(undefined);
    const processor = makeProcessor({
      rows: [
        {
          eventId: 'ev-1',
          eventType: 'review.metrics.refreshed',
          payload: { quizId: 'q-1' },
          attemptCount: 0,
        },
      ],
      reviewEventBus: { dispatchStrict },
    });

    await processor.processPendingEvents();

    expect(dispatchStrict).toHaveBeenCalledTimes(1);
    const event = dispatchStrict.mock.calls[0]?.[0];
    expect(event.eventType).toBe('review.submitted');
    expect(event.payload.quizId).toBe('q-1');
  });

  it('marks the row as failed when payload is missing quizId', async () => {
    const dispatchStrict = jest.fn().mockResolvedValue(undefined);
    const processor = makeProcessor({
      rows: [
        {
          eventId: 'ev-1',
          eventType: 'review.metrics.refreshed',
          payload: {},
          attemptCount: 0,
        },
      ],
      reviewEventBus: { dispatchStrict },
    });

    const result = await processor.processPendingEvents();

    expect(result.failed).toBe(1);
    expect(dispatchStrict).not.toHaveBeenCalled();
  });

  it('continues draining the next row when a subscriber handler rejects (Promise.allSettled semantics)', async () => {
    const dispatchStrict = jest.fn().mockResolvedValue(undefined);
    const processor = makeProcessor({
      rows: [
        {
          eventId: 'ev-1',
          eventType: 'review.metrics.refreshed',
          payload: { quizId: 'q-1' },
          attemptCount: 0,
        },
        {
          eventId: 'ev-2',
          eventType: 'review.metrics.refreshed',
          payload: { quizId: 'q-2' },
          attemptCount: 0,
        },
      ],
      reviewEventBus: { dispatchStrict },
    });

    const result = await processor.processPendingEvents();

    expect(result.processed).toBe(2);
    expect(result.failed).toBe(0);
    expect(dispatchStrict).toHaveBeenCalledTimes(2);
  });
});

describe('ReviewOutboxProcessorService (failed_at not processed_at on poison)', () => {
  it('sets failed_at + dlq_reason (not processed_at) when poison threshold is reached', async () => {
    const dispatchStrict = jest.fn().mockResolvedValue(undefined);
    const db = makeDbHandle([
      { eventId: 'ev-1', eventType: 'review.metrics.refreshed', payload: {}, attemptCount: 9 },
    ]);
    const processor = new ReviewOutboxProcessorService(
      db,
      { dispatchStrict } as unknown as ReviewDomainEventBusPort,
      makeLogger(),
    );

    await processor.processPendingEvents();

    expect(db.update).toHaveBeenCalled();
    const setCalls = db.update.mock.results[0].value.set.mock.calls;
    expect(setCalls.length).toBeGreaterThan(0);
    const updateValues = setCalls[0][0];
    expect(updateValues).toHaveProperty('failedAt');
    expect(updateValues).toHaveProperty('dlqReason');
    expect(updateValues).not.toHaveProperty('processedAt');
  });

  it('sets failed_at + dlq_reason when ReviewOutboxPayloadError is thrown', async () => {
    const dispatchStrict = jest.fn().mockImplementation(() => {
      throw new ReviewOutboxPayloadError('payload bad');
    });
    const db = makeDbHandle([
      {
        eventId: 'ev-2',
        eventType: 'review.metrics.refreshed',
        payload: { quizId: 'q-x' },
        attemptCount: 0,
      },
    ]);
    const processor = new ReviewOutboxProcessorService(
      db,
      { dispatchStrict } as unknown as ReviewDomainEventBusPort,
      makeLogger(),
    );

    await processor.processPendingEvents();

    expect(db.update).toHaveBeenCalled();
    const setCalls = db.update.mock.results[0].value.set.mock.calls;
    expect(setCalls.length).toBeGreaterThan(0);
    const updateValues = setCalls[0][0];
    expect(updateValues).toHaveProperty('failedAt');
    expect(updateValues).toHaveProperty('dlqReason');
  });
});

describe('ReviewOutboxProcessorService (DLQ monitor)', () => {
  it('logs a DLQ alert when poisoned rows exist', async () => {
    const db = makeDbHandle(
      [],
      [
        { eventId: 'e-1', attemptCount: 1 },
        { eventId: 'e-2', attemptCount: 2 },
      ],
    );
    const logger = makeLogger();
    const processor = new ReviewOutboxProcessorService(
      db,
      { dispatchStrict: jest.fn() } as unknown as ReviewDomainEventBusPort,
      logger,
    );

    await processor.monitorDeadLetterQueue();

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'review_outbox_dlq_alert',
        totalDlqEvents: 2,
      }),
    );
  });

  it('does NOT log when DLQ is empty', async () => {
    const db = makeDbHandle([], []);
    const logger = makeLogger();
    const processor = new ReviewOutboxProcessorService(
      db,
      { dispatchStrict: jest.fn() } as unknown as ReviewDomainEventBusPort,
      logger,
    );

    await processor.monitorDeadLetterQueue();

    expect(logger.error).not.toHaveBeenCalled();
  });
});
