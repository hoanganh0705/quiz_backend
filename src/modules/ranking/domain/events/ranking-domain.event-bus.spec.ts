/* eslint-disable @typescript-eslint/unbound-method */
import type { PinoLogger } from 'nestjs-pino';
import { RankingDomainEventBus } from './ranking-domain.event-bus';
import type { RankingDomainEventBusPort } from '../ports';
import { RankingPeriod, RankingMilestone } from '../types/ranking.types';

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

describe('RankingDomainEventBus', () => {
  let bus: RankingDomainEventBusPort;

  beforeEach(() => {
    bus = new RankingDomainEventBus(makeLogger());
  });

  it('dispatches emitted events to subscribed handlers', () => {
    const handler = jest.fn();
    bus.subscribe(handler);

    bus.emitRankChanged({
      eventType: 'rank.changed',
      userId: 'user-1',
      period: RankingPeriod.WEEKLY,
      previousRank: 10,
      newRank: 5,
      previousXp: 0,
      newXp: 100,
      timestamp: new Date(),
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'rank.changed',
        userId: 'user-1',
        previousRank: 10,
        newRank: 5,
      }),
    );
  });

  it('returns an unsubscribe function that stops further dispatches', () => {
    const handler = jest.fn();
    const unsubscribe = bus.subscribe(handler);

    bus.emitRankChanged({
      eventType: 'rank.changed',
      userId: 'user-1',
      period: RankingPeriod.WEEKLY,
      previousRank: 10,
      newRank: 5,
      previousXp: 0,
      newXp: 100,
      timestamp: new Date(),
    });
    expect(handler).toHaveBeenCalledTimes(1);

    unsubscribe();

    bus.emitRankChanged({
      eventType: 'rank.changed',
      userId: 'user-2',
      period: RankingPeriod.MONTHLY,
      previousRank: 20,
      newRank: 18,
      previousXp: 0,
      newXp: 50,
      timestamp: new Date(),
    });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('isolates handler failures so one bad subscriber does not block others', () => {
    const logger = makeLogger();
    const localBus = new RankingDomainEventBus(logger);
    const failing = jest.fn(() => {
      throw new Error('boom');
    });
    const healthy = jest.fn();

    localBus.subscribe(failing);
    localBus.subscribe(healthy);

    localBus.emitPeakRankAchieved({
      eventType: 'peak.rank.achieved',
      userId: 'user-1',
      period: RankingPeriod.WEEKLY,
      previousPeakRank: null,
      newPeakRank: 5,
      isInitialAchievement: true,
      timestamp: new Date(),
    });

    expect(failing).toHaveBeenCalledTimes(1);
    expect(healthy).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'ranking_event_handler_error',
        eventType: 'peak.rank.achieved',
      }),
    );
  });

  it('dispatches each event type through its dedicated emitter', () => {
    const handler = jest.fn();
    bus.subscribe(handler);

    const now = new Date();

    bus.emitXpAdded({
      eventType: 'xp.added',
      userId: 'user-1',
      amount: 25,
      newAllTimeXp: 100,
      newWeeklyXp: 25,
      newMonthlyXp: 25,
      newDailyXp: 25,
      timestamp: now,
    });
    bus.emitRankingMilestone({
      eventType: 'ranking.milestone',
      userId: 'user-1',
      period: RankingPeriod.WEEKLY,
      milestoneType: RankingMilestone.TOP_10,
      rank: 9,
      percentile: 95,
      timestamp: now,
    });
    bus.emitConsistencyCheck({
      eventType: 'consistency.check',
      issuesFound: 0,
      issuesFixed: 0,
      timestamp: now,
    });

    expect(handler).toHaveBeenCalledTimes(3);
  });

  it('does not double-dispatch when the same handler is subscribed twice', () => {
    const handler = jest.fn();
    bus.subscribe(handler);
    bus.subscribe(handler);

    bus.emitRankChanged({
      eventType: 'rank.changed',
      userId: 'user-1',
      period: RankingPeriod.ALL_TIME,
      previousRank: null,
      newRank: 1,
      previousXp: 0,
      newXp: 1000,
      timestamp: new Date(),
    });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('dispatches to a snapshot of handlers so mutations during dispatch are safe', () => {
    const second = jest.fn();
    let unsubscribeFirst: (() => void) | null = null;
    const first = jest.fn(() => {
      unsubscribeFirst?.();
    });

    unsubscribeFirst = bus.subscribe(first);
    bus.subscribe(second);

    bus.emitRankChanged({
      eventType: 'rank.changed',
      userId: 'user-1',
      period: RankingPeriod.WEEKLY,
      previousRank: 10,
      newRank: 5,
      previousXp: 0,
      newXp: 100,
      timestamp: new Date(),
    });

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });
});
