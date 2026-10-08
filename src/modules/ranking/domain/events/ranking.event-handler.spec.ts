import type { PinoLogger } from 'nestjs-pino';
import { RankingEventHandler } from './ranking.event-handler';
import type { ExternalEventBusConsumerPort } from '@/common/events/common-external-event-bus';

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

const makeHandler = (): {
  handler: RankingEventHandler;
  xpIngestionService: { processXpEvent: jest.Mock };
  captured: () => (event: unknown) => Promise<void>;
} => {
  let boundHandler: ((event: unknown) => Promise<void>) | null = null;
  const xpIngestionService = { processXpEvent: jest.fn().mockResolvedValue(undefined) };
  const eventBus: ExternalEventBusConsumerPort = {
    subscribe: jest.fn((_topic: string, fn: (event: unknown) => Promise<void>) => {
      boundHandler = fn;
      return () => undefined;
    }),
  };
  const handler = new RankingEventHandler(
    xpIngestionService as unknown as never,
    eventBus,
    makeLogger(),
  );
  return {
    handler,
    xpIngestionService,
    captured: () => {
      if (!boundHandler) throw new Error('handler not subscribed');
      return boundHandler;
    },
  };
};

const baseEvent = {
  userId: 'user-1',
  amount: 30,
  source: 'tournament',
  correlationId: 'corr-1',
};

describe('RankingEventHandler', () => {
  it('passes source=outbox when calling processXpEvent', async () => {
    const { handler, xpIngestionService, captured } = makeHandler();
    handler.onModuleInit();

    await captured()(baseEvent);

    expect(xpIngestionService.processXpEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'external.xp.earned',
        userId: 'user-1',
        amount: 30,
      }),
      'outbox',
    );
  });

  it('does not throw when processXpEvent fails — the handler must never break the bus', async () => {
    const { handler, xpIngestionService, captured } = makeHandler();
    handler.onModuleInit();
    xpIngestionService.processXpEvent.mockRejectedValueOnce(new Error('downstream'));

    await expect(captured()(baseEvent)).resolves.toBeUndefined();
  });
});
