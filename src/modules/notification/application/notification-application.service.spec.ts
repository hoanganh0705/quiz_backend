/**
 * NotificationApplicationService unit tests.
 *
 * Tests the application service methods:
 *   - `getNotifications` — pagination with cursor
 *   - `getNotificationDetail` — single notification with error handling
 *   - `markAsRead` / `markAsUnread` — status updates with ownership validation
 *   - `markAllAsRead` — bulk status update
 *   - `deleteNotification` — soft delete with ownership validation
 *   - `deleteReadNotifications` — bulk delete
 *   - `getUnreadCount` — unread count
 *   - `getAnalytics` — analytics aggregation
 *   - `updatePreferences` — preference update with cache invalidation
 *   - `getOrCreatePreferences` — get or create preferences
 */
import { NotificationApplicationService } from './notification-application.service';
import { NotificationNotFoundError, NotificationForbiddenError } from '../domain/errors';

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
} as unknown as jest.Mocked<{
  info: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
  debug: jest.Mock;
}>;

const createMockRepository = () => ({
  findById: jest.fn(),
  findByUser: jest.fn(),
  create: jest.fn(),
  countUnread: jest.fn(),
  markAsRead: jest.fn(),
  markAsUnread: jest.fn(),
  markAllAsRead: jest.fn(),
  delete: jest.fn(),
  softDelete: jest.fn(),
  deleteReadNotifications: jest.fn(),
  deleteExpired: jest.fn(),
  getAnalytics: jest.fn(),
});

const createMockPreferencesRepository = () => ({
  getPreferences: jest.fn(),
  upsertPreferences: jest.fn(),
});

const createMockEventBus = () => ({
  emit: jest.fn(),
});

const createMockChannelService = () => ({
  send: jest.fn(),
  invalidatePreferencesCache: jest.fn(),
});

const createNotification = (overrides: Partial<{
  notificationId: string;
  userId: string;
  type: string;
  title: string;
  message: string;
}> = {}) => ({
  notificationId: 'notif-1',
  userId: 'user-1',
  type: 'achievement_earned',
  title: 'Achievement Earned',
  message: 'You earned a new achievement!',
  metadata: {},
  channel: 'in_app' as const,
  isRead: false,
  readAt: null,
  expiresAt: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  deletedAt: null,
  ...overrides,
});

const createPreferences = (overrides: Partial<{
  inAppEnabled: boolean;
  emailEnabled: boolean;
}> = {}) => ({
  preferencesId: 'pref-1',
  userId: 'user-1',
  inAppEnabled: true,
  emailEnabled: true,
  pushEnabled: true,
  achievementEnabled: true,
  tournamentEnabled: true,
  rankEnabled: true,
  friendEnabled: true,
  discussionEnabled: true,
  summaryEnabled: true,
  marketingEnabled: false,
  rankImprovementThreshold: 5,
  quietHoursStart: null,
  quietHoursEnd: null,
  updatedAt: '2024-01-01T00:00:00.000Z',
  createdAt: '2024-01-01T00:00:00.000Z',
  ...overrides,
});

const createUser = (userId: string = 'user-1') => ({
  sub: userId,
  email: 'user@example.com',
  username: 'testuser',
});

describe('NotificationApplicationService', () => {
  let mockRepo: ReturnType<typeof createMockRepository>;
  let mockPrefsRepo: ReturnType<typeof createMockPreferencesRepository>;
  let mockEventBus: ReturnType<typeof createMockEventBus>;
  let mockChannelService: ReturnType<typeof createMockChannelService>;
  let service: NotificationApplicationService;

  beforeEach(() => {
    mockRepo = createMockRepository();
    mockPrefsRepo = createMockPreferencesRepository();
    mockEventBus = createMockEventBus();
    mockChannelService = createMockChannelService();

    service = new NotificationApplicationService(
      mockRepo as never,
      mockPrefsRepo as never,
      mockEventBus as never,
      mockChannelService as never,
      mockLogger,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getNotifications', () => {
    it('returns paginated notifications', async () => {
      const notifications = [
        createNotification({ notificationId: 'notif-1' }),
        createNotification({ notificationId: 'notif-2' }),
      ];
      mockRepo.findByUser.mockResolvedValue(notifications);

      const user = createUser();
      const result = await service.getNotifications(user, 20);

      expect(result.items).toHaveLength(2);
      expect(result.pagination.kind).toBe('cursor');
    });

    it('passes date filters to repository', async () => {
      mockRepo.findByUser.mockResolvedValue([]);

      const user = createUser();
      await service.getNotifications(
        user,
        20,
        null,
        undefined,
        undefined,
        undefined,
        '2024-01-01T00:00:00.000Z',
        '2024-12-31T23:59:59.000Z',
      );

      expect(mockRepo.findByUser).toHaveBeenCalled();
    });

    it('returns hasNextPage when more results than limit', async () => {
      const notifications = Array.from({ length: 21 }, (_, i) =>
        createNotification({ notificationId: `notif-${i}` }),
      );
      mockRepo.findByUser.mockResolvedValue(notifications);

      const user = createUser();
      const result = await service.getNotifications(user, 20);

      expect(result.pagination.hasNextPage).toBe(true);
      expect(result.items).toHaveLength(20);
    });

    it('does not set nextCursor when no more results', async () => {
      const notifications = [createNotification()];
      mockRepo.findByUser.mockResolvedValue(notifications);

      const user = createUser();
      const result = await service.getNotifications(user, 20);

      expect(result.pagination.hasNextPage).toBe(false);
      expect(result.pagination.nextCursor).toBeNull();
    });
  });

  describe('getNotificationDetail', () => {
    it('returns notification when found', async () => {
      const notification = createNotification();
      mockRepo.findById.mockResolvedValue(notification);

      const user = createUser();
      const result = await service.getNotificationDetail('notif-1', user);

      expect(result.notificationId).toBe('notif-1');
    });

    it('throws NotificationNotFoundError when not found', async () => {
      mockRepo.findById.mockResolvedValue(null);

      const user = createUser();
      await expect(service.getNotificationDetail('nonexistent', user)).rejects.toThrow(
        NotificationNotFoundError,
      );
    });
  });

  describe('markAsRead', () => {
    it('marks notification as read', async () => {
      const notification = createNotification();
      mockRepo.findById.mockResolvedValue(notification);

      const user = createUser();
      await service.markAsRead('notif-1', user);

      expect(mockRepo.markAsRead).toHaveBeenCalledWith('notif-1', 'user-1');
    });

    it('emits notification.read event', async () => {
      const notification = createNotification();
      mockRepo.findById.mockResolvedValue(notification);

      const user = createUser();
      await service.markAsRead('notif-1', user);

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'notification.read' }),
      );
    });

    it('throws NotificationNotFoundError when not found', async () => {
      mockRepo.findById.mockResolvedValue(null);

      const user = createUser();
      await expect(service.markAsRead('nonexistent', user)).rejects.toThrow(
        NotificationNotFoundError,
      );
    });

    it('throws NotificationForbiddenError when user does not own notification', async () => {
      const notification = createNotification({ userId: 'other-user' });
      mockRepo.findById.mockResolvedValue(notification);

      const user = createUser();
      await expect(service.markAsRead('notif-1', user)).rejects.toThrow(
        NotificationForbiddenError,
      );
    });
  });

  describe('markAsUnread', () => {
    it('marks notification as unread', async () => {
      const notification = createNotification();
      mockRepo.findById.mockResolvedValue(notification);

      const user = createUser();
      await service.markAsUnread('notif-1', user);

      expect(mockRepo.markAsUnread).toHaveBeenCalledWith('notif-1', 'user-1');
    });

    it('emits notification.unread event', async () => {
      const notification = createNotification();
      mockRepo.findById.mockResolvedValue(notification);

      const user = createUser();
      await service.markAsUnread('notif-1', user);

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'notification.unread' }),
      );
    });

    it('throws NotificationNotFoundError when not found', async () => {
      mockRepo.findById.mockResolvedValue(null);

      const user = createUser();
      await expect(service.markAsUnread('nonexistent', user)).rejects.toThrow(
        NotificationNotFoundError,
      );
    });
  });

  describe('markAllAsRead', () => {
    it('marks all user notifications as read', async () => {
      const user = createUser();
      await service.markAllAsRead(user);

      expect(mockRepo.markAllAsRead).toHaveBeenCalledWith('user-1');
    });

    it('logs the action', async () => {
      const user = createUser();
      await service.markAllAsRead(user);

      expect(mockLogger.info).toHaveBeenCalledWith({
        event: 'all_notifications_marked_read',
        userId: 'user-1',
      });
    });
  });

  describe('deleteNotification', () => {
    it('soft deletes notification', async () => {
      const notification = createNotification();
      mockRepo.findById.mockResolvedValue(notification);

      const user = createUser();
      await service.deleteNotification('notif-1', user);

      expect(mockRepo.delete).toHaveBeenCalledWith('notif-1', 'user-1');
    });

    it('emits notification.deleted event', async () => {
      const notification = createNotification();
      mockRepo.findById.mockResolvedValue(notification);

      const user = createUser();
      await service.deleteNotification('notif-1', user);

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'notification.deleted' }),
      );
    });

    it('throws NotificationNotFoundError when not found', async () => {
      mockRepo.findById.mockResolvedValue(null);

      const user = createUser();
      await expect(service.deleteNotification('nonexistent', user)).rejects.toThrow(
        NotificationNotFoundError,
      );
    });

    it('throws NotificationForbiddenError when user does not own notification', async () => {
      const notification = createNotification({ userId: 'other-user' });
      mockRepo.findById.mockResolvedValue(notification);

      const user = createUser();
      await expect(service.deleteNotification('notif-1', user)).rejects.toThrow(
        NotificationForbiddenError,
      );
    });
  });

  describe('deleteReadNotifications', () => {
    it('soft deletes all read notifications', async () => {
      mockRepo.deleteReadNotifications.mockResolvedValue(5);

      const user = createUser();
      const result = await service.deleteReadNotifications(user);

      expect(result).toBe(5);
      expect(mockLogger.info).toHaveBeenCalledWith({
        event: 'read_notifications_deleted',
        userId: 'user-1',
        deletedCount: 5,
      });
    });

    it('returns 0 when no read notifications', async () => {
      mockRepo.deleteReadNotifications.mockResolvedValue(0);

      const user = createUser();
      const result = await service.deleteReadNotifications(user);

      expect(result).toBe(0);
    });
  });

  describe('getUnreadCount', () => {
    it('returns unread count', async () => {
      mockRepo.countUnread.mockResolvedValue(10);

      const user = createUser();
      const result = await service.getUnreadCount(user);

      expect(result).toBe(10);
    });
  });

  describe('getAnalytics', () => {
    it('returns analytics data', async () => {
      mockRepo.getAnalytics.mockResolvedValue({
        total: 100,
        unread: 25,
        byType: { achievement_earned: 50 },
        byChannel: { in_app: 80 },
        last24h: 10,
        last7d: 50,
      });

      const result = await service.getAnalytics();

      expect(result.total).toBe(100);
      expect(result.unread).toBe(25);
    });
  });

  describe('updatePreferences', () => {
    it('updates preferences and invalidates cache', async () => {
      const updatedPrefs = createPreferences({ inAppEnabled: false });
      mockPrefsRepo.upsertPreferences.mockResolvedValue(updatedPrefs);
      mockChannelService.invalidatePreferencesCache.mockResolvedValue(undefined);

      const user = createUser();
      const result = await service.updatePreferences(user, { inAppEnabled: false });

      expect(mockPrefsRepo.upsertPreferences).toHaveBeenCalledWith('user-1', { inAppEnabled: false });
      expect(mockChannelService.invalidatePreferencesCache).toHaveBeenCalledWith('user-1');
      expect(result.inAppEnabled).toBe(false);
    });

    it('works when cache invalidation is not available', async () => {
      const serviceWithoutCache = new NotificationApplicationService(
        mockRepo as never,
        mockPrefsRepo as never,
        mockEventBus as never,
        undefined,
        mockLogger,
      );
      const updatedPrefs = createPreferences();
      mockPrefsRepo.upsertPreferences.mockResolvedValue(updatedPrefs);

      const user = createUser();
      const result = await serviceWithoutCache.updatePreferences(user, {});

      expect(result).toBeDefined();
    });
  });

  describe('getOrCreatePreferences', () => {
    it('returns existing preferences', async () => {
      const existingPrefs = createPreferences();
      mockPrefsRepo.getPreferences.mockResolvedValue(existingPrefs);

      const user = createUser();
      const result = await service.getOrCreatePreferences(user);

      expect(result).toEqual(expect.objectContaining({ userId: 'user-1' }));
    });

    it('creates preferences when none exist', async () => {
      const newPrefs = createPreferences();
      mockPrefsRepo.getPreferences.mockResolvedValue(null);
      mockPrefsRepo.upsertPreferences.mockResolvedValue(newPrefs);

      const user = createUser();
      const result = await service.getOrCreatePreferences(user);

      expect(mockPrefsRepo.upsertPreferences).toHaveBeenCalledWith('user-1', {});
      expect(result).toBeDefined();
    });
  });
});
