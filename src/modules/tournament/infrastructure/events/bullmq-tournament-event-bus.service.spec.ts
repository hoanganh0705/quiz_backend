/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { BullmqTournamentEventBusService } from './bullmq-tournament-event-bus.service';
import { TournamentWonEvent } from '../../domain/events';
import type { TournamentFlagsConfig } from '@/core/config';

type AnyQueue = { add: jest.Mock };

function makeFlags(tournamentBullMqDisable: boolean): TournamentFlagsConfig {
  return { tournamentBullMqDisable } as TournamentFlagsConfig;
}

function makeLogger(): any {
  return {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

describe('BullmqTournamentEventBusService (flag-gated publish)', () => {
  it('does NOT call eventQueue.add when TOURNAMENT_BULLMQ_DISABLE is true', async () => {
    const queue: AnyQueue = { add: jest.fn().mockResolvedValue(undefined) };
    const service = new BullmqTournamentEventBusService(
      queue as any,
      makeFlags(true),
      makeLogger(),
    );

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

    expect(queue.add).not.toHaveBeenCalled();
  });

  it('calls eventQueue.add when TOURNAMENT_BULLMQ_DISABLE is false', async () => {
    const queue: AnyQueue = { add: jest.fn().mockResolvedValue(undefined) };
    const service = new BullmqTournamentEventBusService(
      queue as any,
      makeFlags(false),
      makeLogger(),
    );

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

    expect(queue.add).toHaveBeenCalledTimes(1);
    expect(queue.add.mock.calls[0]?.[0]).toBe('tournament.won');
  });

  it('still dispatches to in-process handlers when flag is true', async () => {
    const queue: AnyQueue = { add: jest.fn() };
    const service = new BullmqTournamentEventBusService(
      queue as any,
      makeFlags(true),
      makeLogger(),
    );
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
    expect(queue.add).not.toHaveBeenCalled();
  });
});
