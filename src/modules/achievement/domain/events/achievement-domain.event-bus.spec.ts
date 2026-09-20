/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { AchievementDomainEventBus } from './achievement-domain.event-bus';
import type { AchievementDomainEvent } from './achievement.events';
import type { BadgeDefinitionRow } from '../../infrastructure/repositories/achievement.repository';

function buildBadge(): BadgeDefinitionRow {
  return {
    badgeId: 'badge-1',
    slug: 'rank1',
    type: 'gold',
    category: 'ranking',
    name: 'Rank 1',
    description: null,
    iconUrl: null,
    isActive: true,
    isHidden: false,
    version: '1.0.0',
    validFrom: null,
    validUntil: null,
    evaluationMode: 'realtime',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function createFakeLogger() {
  return {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  } as const;
}

describe('AchievementDomainEventBus', () => {
  let bus: AchievementDomainEventBus;

  beforeEach(() => {
    bus = new AchievementDomainEventBus(createFakeLogger() as never);
  });

  it('subscribes a per-event-type handler and removes via unsubscribe', () => {
    const handler = jest.fn();
    const subscription = bus.subscribe('badge.earned', handler);

    bus.emitBadgeEarned({ userId: 'user-1', badgeSlug: 'rank1', badgeName: 'Rank 1' });
    expect(handler).toHaveBeenCalledTimes(1);

    subscription.unsubscribe();
    bus.emitBadgeEarned({ userId: 'user-1', badgeSlug: 'rank1', badgeName: 'Rank 1' });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('subscribes a global handler', () => {
    const handler = jest.fn();
    bus.subscribeAll(handler);

    bus.emitBadgeRevoked({
      userId: 'user-1',
      badgeId: 'badge-1',
      badgeSlug: 'rank1',
      revokedAt: new Date(),
      reason: 'admin',
      revokedBy: 'admin-1',
    });
    bus.emitBadgeRestored({
      userId: 'user-1',
      badgeId: 'badge-1',
      badgeSlug: 'rank1',
      restoredAt: new Date(),
      restoredBy: 'admin-1',
    });

    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('propagates handler errors to logger without throwing', () => {
    const handler = jest.fn(() => {
      throw new Error('boom');
    });
    bus.subscribe('badge.earned', handler);

    expect(() =>
      bus.emitBadgeEarned({ userId: 'user-1', badgeSlug: 'rank1', badgeName: 'Rank 1' }),
    ).not.toThrow();
  });

  it('clears all subscriptions', () => {
    const handler = jest.fn();
    bus.subscribe('badge.earned', handler);
    bus.subscribeAll(handler);
    bus.clear();

    bus.emitBadgeEarned({ userId: 'user-1', badgeSlug: 'rank1', badgeName: 'Rank 1' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('emits achievement.awarded with all fields', () => {
    const handler = jest.fn();
    bus.subscribe('achievement.awarded', handler);

    bus.emitAchievementAwarded({
      userId: 'user-1',
      badgeId: 'badge-1',
      badge: buildBadge(),
      metadata: { period: 'daily', rank: 5 },
    });

    const event = handler.mock.calls[0]?.[0] as AchievementDomainEvent;
    expect(event.eventType).toBe('achievement.awarded');
    expect(event.userId).toBe('user-1');
  });

  it('emits streak.milestone', () => {
    const handler = jest.fn();
    bus.subscribe('streak.milestone', handler);

    bus.emitStreakMilestone({ userId: 'user-1', streakDays: 7 });
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
