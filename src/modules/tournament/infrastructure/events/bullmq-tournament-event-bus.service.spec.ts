/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { BullmqTournamentEventBusService } from './bullmq-tournament-event-bus.service';
import { TournamentWonEvent } from '../../domain/events';

type AnyQueue = { add: jest.Mock };

function makeLogger(): any {
  return {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

describe('BullmqTournamentEventBusService (in-process dispatch)', () => {
  it('dispatches to in-process handlers on publish', async () => {
    const queue: AnyQueue = { add: jest.fn() };
    const service = new BullmqTournamentEventBusService(queue as any, makeLogger());
    const handler = jest.fn();
    service.subscribe(handler);

    const event = new TournamentWonEvent(
      'u-1',
      't-1',
      'Weekly Cup',
      'Trivia',
      1,
      'badge',
      new Date(),
    );
    await service.publish(event);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(event);
  });

  it('unsubscribes handler when unregister function is called', async () => {
    const queue: AnyQueue = { add: jest.fn() };
    const service = new BullmqTournamentEventBusService(queue as any, makeLogger());
    const handler = jest.fn();
    const unsubscribe = service.subscribe(handler);

    unsubscribe();

    const event = new TournamentWonEvent(
      'u-1',
      't-1',
      'Weekly Cup',
      'Trivia',
      1,
      'badge',
      new Date(),
    );
    await service.publish(event);

    expect(handler).not.toHaveBeenCalled();
  });

  it('catches and logs handler failure without throwing', async () => {
    const queue: AnyQueue = { add: jest.fn() };
    const logger = makeLogger();
    const service = new BullmqTournamentEventBusService(queue as any, logger);
    const handler = jest.fn().mockRejectedValue(new Error('handler failed'));
    service.subscribe(handler);

    const event = new TournamentWonEvent(
      'u-1',
      't-1',
      'Weekly Cup',
      'Trivia',
      1,
      'badge',
      new Date(),
    );

    await expect(service.publish(event)).resolves.not.toThrow();
    expect(logger.error).toHaveBeenCalled();
  });
});
