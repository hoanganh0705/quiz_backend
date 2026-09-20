import type { PinoLogger } from 'nestjs-pino';
import { NotificationApplicationService } from './notification-application.service';
import { NotificationNotFoundError, NotificationForbiddenError } from '../domain/errors';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import type { NotificationRepositoryPort } from '../domain/ports';
import type { NotificationPreferencesRepositoryPort } from '../domain/ports';
import type { NotificationDomainEventBus } from '../domain/ports';
import type { NotificationChannelServiceInstance } from '../domain/ports';
import { NotificationService } from '../domain/notification.service';
import type {
  Notification as DomainNotification,
  NotificationPreferencesRow,
} from '../domain/types/notification.types';

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

function makeJwtPayload(userId: string): JwtPayload {
  return { sub: userId } as JwtPayload;
}

function makeNotification(overrides: Partial<DomainNotification> = {}): DomainNotification {
  return {
    notificationId: '11111111-1111-7111-8111-111111111111',
    userId: 'user-1',
    type: 'achievement_earned',
    title: 'Test',
    message: 'Test message',
    metadata: null,
    channel: 'in_app',
    isRead: false,
    readAt: null,
    createdAt: '2025-06-01T10:00:00.000Z',
    expiresAt: null,
    ...overrides,
  };
}

function makeService(
  opts: {
    notificationRepository?: Partial<NotificationRepositoryPort>;
    preferencesRepository?: Partial<NotificationPreferencesRepositoryPort>;
    notificationService?: Partial<NotificationService>;
    channelService?: Partial<NotificationChannelServiceInstance>;
  } = {},
) {
  const notificationRepository: NotificationRepositoryPort = {
    create: jest.fn(),
    findById: jest.fn(),
    findByUser: jest.fn(),
    countUnread: jest.fn(),
    markAsRead: jest.fn(),
    markAsUnread: jest.fn(),
    markAllAsRead: jest.fn().mockResolvedValue(0),
    deleteReadNotifications: jest.fn().mockResolvedValue(0),
    delete: jest.fn(),
    softDelete: jest.fn(),
    listUnreadIds: jest.fn().mockResolvedValue([]),
    listReadIds: jest.fn().mockResolvedValue([]),
    deleteExpired: jest.fn(),
    getAnalytics: jest.fn(),
    invalidateAnalyticsCache: jest.fn().mockResolvedValue(undefined),
    findByIdempotencyKey: jest.fn(),
    ...opts.notificationRepository,
  } as NotificationRepositoryPort;

  const preferencesRepository: NotificationPreferencesRepositoryPort = {
    getPreferences: jest.fn(),
    getManyPreferences: jest.fn(),
    upsertPreferences: jest.fn(),
    ...opts.preferencesRepository,
  } as unknown as NotificationPreferencesRepositoryPort;

  const notificationService = {
    getNotifications: jest.fn(),
    getNotification: jest.fn(),
    getUnreadCount: jest.fn(),
    ...opts.notificationService,
  } as unknown as NotificationService;

  const channelService: NotificationChannelServiceInstance = {
    invalidatePreferencesCache: jest.fn().mockResolvedValue(undefined),
    ...opts.channelService,
  } as NotificationChannelServiceInstance;

  const eventBus = {
    emit: jest.fn(),
    subscribe: jest.fn(),
    subscribeAll: jest.fn(),
    clear: jest.fn(),
  } as unknown as NotificationDomainEventBus;

  const service = new NotificationApplicationService(
    notificationService,
    notificationRepository,
    preferencesRepository,
    eventBus,
    channelService,
    makeLogger(),
  );

  return {
    service,
    notificationRepository,
    preferencesRepository,
    notificationService,
    eventBus,
    channelService,
  };
}

describe('NotificationApplicationService.getNotificationDetail', () => {
  it('returns DTO when notification exists and belongs to user', async () => {
    const { service } = makeService({
      notificationService: {
        getNotification: jest.fn().mockResolvedValue(makeNotification({ notificationId: 'n-1' })),
      },
    });
    const result = await service.getNotificationDetail('n-1', makeJwtPayload('user-1'));
    expect(result.notificationId).toBe('n-1');
    expect(result.userId).toBe('user-1');
  });

  it('throws NotificationNotFoundError when notification is null', async () => {
    const { service } = makeService({
      notificationService: {
        getNotification: jest.fn().mockResolvedValue(null),
      },
    });
    await expect(
      service.getNotificationDetail('missing', makeJwtPayload('user-1')),
    ).rejects.toBeInstanceOf(NotificationNotFoundError);
  });
});

describe('NotificationApplicationService.markAsRead', () => {
  it('emits notification.read event and logs success', async () => {
    const notification = makeNotification({ notificationId: 'n-1', userId: 'user-1' });
    const { service, notificationRepository, eventBus } = makeService({
      notificationService: { getNotification: jest.fn().mockResolvedValue(notification) },
    });
    await service.markAsRead('n-1', makeJwtPayload('user-1'));
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(notificationRepository.markAsRead).toHaveBeenCalledWith('n-1', 'user-1');
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(eventBus.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'notification.read',
        notificationId: 'n-1',
        userId: 'user-1',
      }),
    );
  });

  it('throws NotificationNotFoundError when notification missing', async () => {
    const { service } = makeService({
      notificationService: { getNotification: jest.fn().mockResolvedValue(null) },
    });
    await expect(service.markAsRead('missing', makeJwtPayload('user-1'))).rejects.toBeInstanceOf(
      NotificationNotFoundError,
    );
  });

  it('throws NotificationForbiddenError when notification belongs to a different user', async () => {
    const notification = makeNotification({ notificationId: 'n-1', userId: 'user-2' });
    const { service } = makeService({
      notificationService: { getNotification: jest.fn().mockResolvedValue(notification) },
    });
    await expect(service.markAsRead('n-1', makeJwtPayload('user-1'))).rejects.toBeInstanceOf(
      NotificationForbiddenError,
    );
  });
});

describe('NotificationApplicationService.markAsUnread', () => {
  it('emits notification.unread event on success', async () => {
    const notification = makeNotification({
      notificationId: 'n-1',
      userId: 'user-1',
      isRead: true,
    });
    const { service, notificationRepository, eventBus } = makeService({
      notificationService: { getNotification: jest.fn().mockResolvedValue(notification) },
    });
    await service.markAsUnread('n-1', makeJwtPayload('user-1'));
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(notificationRepository.markAsUnread).toHaveBeenCalledWith('n-1', 'user-1');
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(eventBus.emit).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'notification.unread', notificationId: 'n-1' }),
    );
  });

  it('throws NotificationNotFoundError when missing', async () => {
    const { service } = makeService({
      notificationService: { getNotification: jest.fn().mockResolvedValue(null) },
    });
    await expect(service.markAsUnread('missing', makeJwtPayload('user-1'))).rejects.toBeInstanceOf(
      NotificationNotFoundError,
    );
  });

  it('throws NotificationForbiddenError when wrong owner', async () => {
    const notification = makeNotification({ notificationId: 'n-1', userId: 'user-2' });
    const { service } = makeService({
      notificationService: { getNotification: jest.fn().mockResolvedValue(notification) },
    });
    await expect(service.markAsUnread('n-1', makeJwtPayload('user-1'))).rejects.toBeInstanceOf(
      NotificationForbiddenError,
    );
  });
});

describe('NotificationApplicationService.markAllAsRead', () => {
  it('emits one read event per unread id and returns count', async () => {
    const { service, eventBus } = makeService({
      notificationRepository: {
        listUnreadIds: jest.fn().mockResolvedValue(['n-1', 'n-2', 'n-3']),
        markAllAsRead: jest.fn().mockResolvedValue(3),
      },
    });
    const count = await service.markAllAsRead(makeJwtPayload('user-1'));
    expect(count).toBe(3);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(eventBus.emit).toHaveBeenCalledTimes(3);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(eventBus.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'notification.read',
        notificationId: 'n-1',
        userId: 'user-1',
      }),
    );
  });

  it('emits zero events when user has no unread notifications', async () => {
    const { service, eventBus } = makeService({
      notificationRepository: {
        listUnreadIds: jest.fn().mockResolvedValue([]),
        markAllAsRead: jest.fn().mockResolvedValue(0),
      },
    });
    await service.markAllAsRead(makeJwtPayload('user-1'));
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(eventBus.emit).not.toHaveBeenCalled();
  });
});

describe('NotificationApplicationService.deleteNotification', () => {
  it('emits notification.deleted on success', async () => {
    const notification = makeNotification({ notificationId: 'n-1', userId: 'user-1' });
    const { service, notificationRepository, eventBus } = makeService({
      notificationService: { getNotification: jest.fn().mockResolvedValue(notification) },
    });
    await service.deleteNotification('n-1', makeJwtPayload('user-1'));
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(notificationRepository.delete).toHaveBeenCalledWith('n-1', 'user-1');
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(eventBus.emit).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'notification.deleted', notificationId: 'n-1' }),
    );
  });

  it('throws NotificationNotFoundError when missing', async () => {
    const { service } = makeService({
      notificationService: { getNotification: jest.fn().mockResolvedValue(null) },
    });
    await expect(
      service.deleteNotification('missing', makeJwtPayload('user-1')),
    ).rejects.toBeInstanceOf(NotificationNotFoundError);
  });

  it('throws NotificationForbiddenError when wrong owner', async () => {
    const notification = makeNotification({ notificationId: 'n-1', userId: 'user-2' });
    const { service } = makeService({
      notificationService: { getNotification: jest.fn().mockResolvedValue(notification) },
    });
    await expect(
      service.deleteNotification('n-1', makeJwtPayload('user-1')),
    ).rejects.toBeInstanceOf(NotificationForbiddenError);
  });
});

describe('NotificationApplicationService.deleteReadNotifications', () => {
  it('emits notification.deleted per read id and invalidates analytics cache', async () => {
    const { service, notificationRepository, eventBus } = makeService({
      notificationRepository: {
        listReadIds: jest.fn().mockResolvedValue(['n-1', 'n-2']),
        deleteReadNotifications: jest.fn().mockResolvedValue(2),
      },
    });
    const count = await service.deleteReadNotifications(makeJwtPayload('user-1'));
    expect(count).toBe(2);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(eventBus.emit).toHaveBeenCalledTimes(2);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(notificationRepository.invalidateAnalyticsCache).toHaveBeenCalled();
  });

  it('emits zero events when nothing to delete', async () => {
    const { service, eventBus } = makeService({
      notificationRepository: {
        listReadIds: jest.fn().mockResolvedValue([]),
        deleteReadNotifications: jest.fn().mockResolvedValue(0),
      },
    });
    await service.deleteReadNotifications(makeJwtPayload('user-1'));
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(eventBus.emit).not.toHaveBeenCalled();
  });
});

describe('NotificationApplicationService.getOrCreatePreferences', () => {
  it('calls upsertPreferences so creation is atomic (race-condition safe)', async () => {
    const upsertPreferences = jest.fn().mockResolvedValue({
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
    } as NotificationPreferencesRow);
    const { service } = makeService({
      preferencesRepository: { upsertPreferences },
    });
    const dto = await service.getOrCreatePreferences(makeJwtPayload('user-1'));
    expect(upsertPreferences).toHaveBeenCalledWith('user-1', {});
    expect(dto.inAppEnabled).toBe(true);
  });
});

describe('NotificationApplicationService.updatePreferences', () => {
  it('upserts prefs, invalidates cache, and returns DTO', async () => {
    const prefs: Partial<NotificationPreferencesRow> = {
      inAppEnabled: false,
      rankEnabled: false,
    };
    const upsertPreferences = jest.fn().mockResolvedValue({
      preferencesId: 'p-1',
      userId: 'user-1',
      inAppEnabled: false,
      emailEnabled: true,
      pushEnabled: true,
      achievementEnabled: true,
      tournamentEnabled: true,
      rankEnabled: false,
      friendEnabled: true,
      commentEnabled: true,
      summaryEnabled: true,
      marketingEnabled: false,
      rankImprovementThreshold: 5,
      quietHoursStart: null,
      quietHoursEnd: null,
      updatedAt: '2025-06-01T10:00:00.000Z',
      createdAt: '2025-06-01T10:00:00.000Z',
    } as NotificationPreferencesRow);
    const { service, channelService } = makeService({
      preferencesRepository: { upsertPreferences },
    });
    const dto = await service.updatePreferences(makeJwtPayload('user-1'), prefs);
    expect(upsertPreferences).toHaveBeenCalledWith('user-1', prefs);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(channelService.invalidatePreferencesCache).toHaveBeenCalledWith('user-1');
    expect(dto.inAppEnabled).toBe(false);
    expect(dto.rankEnabled).toBe(false);
  });
});
