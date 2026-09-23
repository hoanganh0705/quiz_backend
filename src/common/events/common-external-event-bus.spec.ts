import { CommonExternalEventBus } from './common-external-event-bus';
import type { PubSubProvider } from '@/common/ports/pubsub.provider';

function makeLogger(): any {
  return { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() };
}

function makePubSub(): PubSubProvider {
  return {
    publish: jest.fn().mockResolvedValue(undefined),
    createSubscriber: jest.fn(),
  } as unknown as PubSubProvider;
}

const baseEvent = {
  eventType: 'external.xp.earned' as const,
  userId: 'u-1',
  amount: 10,
  source: 'tournament' as const,
  tournamentId: 't-1',
  timestamp: new Date(),
};

describe('CommonExternalEventBus.publishXpEarned (mandatory idempotencyKey)', () => {
  it('throws when idempotencyKey is missing', async () => {
    const bus = new CommonExternalEventBus(makePubSub(), makeLogger());

    await expect(
      // @ts-expect-error -- intentionally omitting the now-required key
      bus.publishXpEarned({ ...baseEvent }),
    ).rejects.toThrow(/idempotencyKey is required/);
  });

  it('throws when idempotencyKey is empty string', async () => {
    const bus = new CommonExternalEventBus(makePubSub(), makeLogger());

    await expect(bus.publishXpEarned({ ...baseEvent, idempotencyKey: '' })).rejects.toThrow(
      /idempotencyKey is required/,
    );
  });

  it('publishes when idempotencyKey is supplied', async () => {
    const pubSub = makePubSub();
    const bus = new CommonExternalEventBus(pubSub, makeLogger());

    await bus.publishXpEarned({ ...baseEvent, idempotencyKey: 't-1:u-1:1' });

    expect(pubSub.publish as jest.Mock).toHaveBeenCalledTimes(1);
  });
});
