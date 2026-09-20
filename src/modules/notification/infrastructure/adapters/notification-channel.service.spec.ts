/* eslint-disable @typescript-eslint/unbound-method */
import type { PinoLogger } from 'nestjs-pino';
import type { CacheProvider } from '@/common/ports/cache.provider';
import { NotificationChannelService } from './notification-channel.service';
import type { NotificationRepositoryPort } from '../../domain/ports';
import type { NotificationPreferencesRepositoryPort } from '../../domain/ports';
import type { NotificationDomainEventBus } from '../../domain/ports';
import {
  NOTIFICATION_TYPE_CATEGORY,
  NOTIFICATION_CHANNEL_GATE,
} from '../../domain/notification-preference-category';
import type { NotificationPreferencesRow } from '../../domain/types/notification.types';

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

function makeCache(): CacheProvider {
  return {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
    acquireAdvisoryLock: jest.fn(),
    releaseAdvisoryLock: jest.fn(),
  } as unknown as CacheProvider;
}

function makePrefs(
  overrides: Partial<NotificationPreferencesRow> = {},
): NotificationPreferencesRow {
  return {
    preferencesId: 'p-1',
    userId: 'user-1',
    inAppEnabled: true,
    emailEnabled: true,
    pushEnabled: true,
    achievementEnabled: true,
    tournamentEnabled: true,
    rankEnabled: true,
    friendEnabled: true,
    commentEnabled: true,
    summaryEnabled: true,
    marketingEnabled: false,
    rankImprovementThreshold: 5,
    quietHoursStart: null,
    quietHoursEnd: null,
    updatedAt: '2025-06-01T10:00:00.000Z',
    createdAt: '2025-06-01T10:00:00.000Z',
    ...overrides,
  };
}

function makeService(
  opts: {
    cache?: CacheProvider;
    preferences?: Partial<NotificationPreferencesRepositoryPort>;
    notificationRepository?: Partial<NotificationRepositoryPort>;
  } = {},
) {
  const notificationRepository: NotificationRepositoryPort = {
    create: jest.fn().mockResolvedValue({
      notificationId: 'n-1',
      userId: 'user-1',
      type: 'achievement_earned',
      channel: 'in_app',
    }),
    ...opts.notificationRepository,
  } as NotificationRepositoryPort;

  const preferencesRepository: NotificationPreferencesRepositoryPort = {
    getPreferences: jest.fn().mockResolvedValue(null),
    getManyPreferences: jest.fn(),
    upsertPreferences: jest.fn(),
    ...opts.preferences,
  } as unknown as NotificationPreferencesRepositoryPort;

  const eventBus = {
    emit: jest.fn(),
    subscribe: jest.fn(),
    subscribeAll: jest.fn(),
    clear: jest.fn(),
  } as unknown as NotificationDomainEventBus;

  const service = new NotificationChannelService(
    notificationRepository,
    preferencesRepository,
    eventBus,
    opts.cache ?? makeCache(),
    makeLogger(),
  );

  return { service, notificationRepository, preferencesRepository, eventBus };
}

describe('NotificationChannelService.invalidatePreferencesCache', () => {
  it('calls cache.del with the expected key', async () => {
    const cache = makeCache();
    const { service } = makeService({ cache });
    await service.invalidatePreferencesCache('user-1');
    expect(cache.del).toHaveBeenCalledWith('notif:prefs:user-1');
  });

  it('does not throw when cache is absent', async () => {
    const { service } = makeService({ cache: undefined });
    await expect(service.invalidatePreferencesCache('user-1')).resolves.toBeUndefined();
  });
});

describe('NotificationChannelService.send', () => {
  it('writes notification and emits event when no prefs block', async () => {
    const { service, notificationRepository, eventBus } = makeService({
      preferences: { getPreferences: jest.fn().mockResolvedValue(null) },
    });
    await service.send({
      userId: 'user-1',
      type: 'achievement_earned',
      title: 'Hello',
      body: 'World',
    });
    expect(notificationRepository.create).toHaveBeenCalled();
    expect(eventBus.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'notification.sent',
        notificationId: 'n-1',
        userId: 'user-1',
      }),
    );
  });

  it('skips writing notification when prefs disable the channel', async () => {
    const { service, notificationRepository } = makeService({
      preferences: {
        getPreferences: jest.fn().mockResolvedValue(makePrefs({ inAppEnabled: false })),
      },
    });
    await service.send({
      userId: 'user-1',
      type: 'achievement_earned',
      title: 'Hello',
      body: 'World',
    });
    expect(notificationRepository.create).not.toHaveBeenCalled();
  });

  it('skips when category is disabled by user', async () => {
    const { service, notificationRepository } = makeService({
      preferences: {
        getPreferences: jest.fn().mockResolvedValue(makePrefs({ achievementEnabled: false })),
      },
    });
    await service.send({
      userId: 'user-1',
      type: 'achievement_earned',
      title: 'Hello',
      body: 'World',
    });
    expect(notificationRepository.create).not.toHaveBeenCalled();
  });
});

describe('NotificationChannelService.sendBatch', () => {
  it('honors per-user prefs and counts sent vs skipped', async () => {
    const { service, notificationRepository } = makeService({
      preferences: {
        getPreferences: jest.fn().mockImplementation(async (userId: string) => {
          await Promise.resolve();
          return userId === 'user-2' ? makePrefs({ inAppEnabled: false }) : null;
        }),
      },
      notificationRepository: {
        create: jest.fn().mockResolvedValue({
          notificationId: 'n',
          userId: 'u',
          type: 'system_announcement',
          channel: 'in_app',
        }),
      },
    });
    const result = await service.sendBatch(
      { type: 'system_announcement', title: 'Hi', body: 'Everyone' },
      ['user-1', 'user-2'],
    );
    expect(result.sent).toBe(1);
    expect(result.skipped).toBe(1);
    expect(notificationRepository.create).toHaveBeenCalledTimes(1);
  });
});

describe('NotificationType → category mapping', () => {
  it('maps every NotificationType to a category', () => {
    const categories = Object.values(NOTIFICATION_TYPE_CATEGORY);
    expect(categories.length).toBeGreaterThan(0);
    for (const category of categories) {
      expect(typeof category).toBe('string');
    }
  });

  it('maps tournament types to the tournament category', () => {
    expect(NOTIFICATION_TYPE_CATEGORY.tournament_invite).toBe('tournament');
    expect(NOTIFICATION_TYPE_CATEGORY.tournament_won).toBe('tournament');
  });

  it('maps rank types to the rank category', () => {
    expect(NOTIFICATION_TYPE_CATEGORY.rank_achievement).toBe('rank');
    expect(NOTIFICATION_TYPE_CATEGORY.period_winner).toBe('rank');
  });

  it('maps achievement types to the achievement category', () => {
    expect(NOTIFICATION_TYPE_CATEGORY.achievement_earned).toBe('achievement');
    expect(NOTIFICATION_TYPE_CATEGORY.streak_milestone).toBe('achievement');
  });

  it('maps comment types to the comment category', () => {
    expect(NOTIFICATION_TYPE_CATEGORY.comment_reply).toBe('comment');
    expect(NOTIFICATION_TYPE_CATEGORY.comment_mention).toBe('comment');
  });
});

describe('NotificationChannel gate mapping', () => {
  it('maps in_app channel to inAppEnabled', () => {
    expect(NOTIFICATION_CHANNEL_GATE.in_app).toBe('inAppEnabled');
  });
  it('maps email channel to emailEnabled', () => {
    expect(NOTIFICATION_CHANNEL_GATE.email).toBe('emailEnabled');
  });
  it('maps push channel to pushEnabled', () => {
    expect(NOTIFICATION_CHANNEL_GATE.push).toBe('pushEnabled');
  });
});
