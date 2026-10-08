import type { PinoLogger } from 'nestjs-pino';
import { AttemptRankingListenerAdapter } from './attempt-ranking-listener.adapter';
import { AttemptCompletedEvent } from '@/modules/attempt/domain/events/attempt-domain.events';
import type { AttemptDomainEventBusPort } from '@/modules/attempt/domain/events/attempt-domain-event-bus.port';

function makeLogger(): PinoLogger {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
    fatal: jest.fn(),
  } as unknown as PinoLogger;
}

const makeAdapter = (): {
  adapter: AttemptRankingListenerAdapter;
  xpIngestionService: { processXpEvent: jest.Mock };
  invokeHandler: (event: unknown) => Promise<void>;
} => {
  const xpIngestionService = { processXpEvent: jest.fn().mockResolvedValue(undefined) };
  let registeredHandler: ((event: unknown) => void) | null = null;
  const eventBus: AttemptDomainEventBusPort = {
    subscribe: jest.fn((handler: (event: unknown) => void) => {
      registeredHandler = handler;
      return () => undefined;
    }),
  };
  const adapter = new AttemptRankingListenerAdapter(
    eventBus,
    xpIngestionService as unknown as never,
    makeLogger(),
  );
  return {
    adapter,
    xpIngestionService,
    invokeHandler: async (event: unknown) => {
      if (!registeredHandler) throw new Error('handler not subscribed');
      registeredHandler(event);
      await new Promise((resolve) => setImmediate(resolve));
    },
  };
};

const completedEvent = new AttemptCompletedEvent(
  'attempt-1',
  'user-1',
  'quiz-1',
  'quiz-version-1',
  '80.00',
  8,
  10,
  12_000,
  25,
  '2026-01-01T00:00:00.000Z',
);

describe('AttemptRankingListenerAdapter', () => {
  it('passes source=in_proc when calling processXpEvent', async () => {
    const { adapter, xpIngestionService, invokeHandler } = makeAdapter();
    adapter.onModuleInit();

    await invokeHandler(completedEvent);

    expect(xpIngestionService.processXpEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: 'xp:user-1:attempt:attempt-1',
      }),
      'in_proc',
    );
  });

  it('skips processing when xpEarned is zero', async () => {
    const { adapter, xpIngestionService, invokeHandler } = makeAdapter();
    adapter.onModuleInit();
    const zeroEvent = new AttemptCompletedEvent(
      'attempt-2',
      'user-2',
      'quiz-2',
      'quiz-version-2',
      '0.00',
      0,
      10,
      12_000,
      0,
      '2026-01-01T00:00:00.000Z',
    );

    await invokeHandler(zeroEvent);

    expect(xpIngestionService.processXpEvent).not.toHaveBeenCalled();
  });

  it('ignores events that are not AttemptCompletedEvent', async () => {
    const { adapter, xpIngestionService, invokeHandler } = makeAdapter();
    adapter.onModuleInit();

    await invokeHandler({ eventType: 'unrelated', payload: 1 });

    expect(xpIngestionService.processXpEvent).not.toHaveBeenCalled();
  });

  it('clears the subscription on onModuleDestroy', () => {
    const { adapter } = makeAdapter();
    adapter.onModuleInit();
    adapter.onModuleDestroy();
    expect(adapter['unsubscribe']).toBeNull();
  });
});
