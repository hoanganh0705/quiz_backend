/**
 * NotificationService unit tests.
 *
 * Tests the domain service methods:
 *   - `getNotifications` — delegates to repository
 *   - `getUnreadCount` — delegates to repository
 *   - `getNotification` — retrieves and validates ownership
 *   - `create` — creates notification with logging
 */
import { NotificationService } from './notification.service';

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

const createMockRepository = () => ({
  findByUser: jest.fn(),
  findById: jest.fn(),
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

describe('NotificationService', () => {
  let mockRepository: ReturnType<typeof createMockRepository>;
  let service: NotificationService;

  beforeEach(() => {
    mockRepository = createMockRepository();
    service = new NotificationService(mockRepository as never, mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getNotifications', () => {
    it('delegates to repository with correct parameters', async () => {
      const notifications = [
        createNotification({ notificationId: 'notif-1' }),
        createNotification({ notificationId: 'notif-2' }),
      ];
      mockRepository.findByUser.mockResolvedValue(notifications);

      const result = await service.getNotifications('user-1', { limit: 20 });

      expect(mockRepository.findByUser).toHaveBeenCalledWith({
        userId: 'user-1',
        limit: 20,
      });
      expect(result).toEqual(notifications);
    });

    it('passes additional filter parameters', async () => {
      mockRepository.findByUser.mockResolvedValue([]);

      await service.getNotifications('user-1', {
        limit: 10,
        unreadOnly: true,
        type: 'achievement_earned',
      });

      expect(mockRepository.findByUser).toHaveBeenCalledWith({
        userId: 'user-1',
        limit: 10,
        unreadOnly: true,
        type: 'achievement_earned',
      });
    });

    it('passes date filter parameters', async () => {
      mockRepository.findByUser.mockResolvedValue([]);

      await service.getNotifications('user-1', {
        limit: 10,
        fromDate: '2024-01-01T00:00:00.000Z',
        toDate: '2024-12-31T23:59:59.000Z',
      });

      expect(mockRepository.findByUser).toHaveBeenCalledWith({
        userId: 'user-1',
        limit: 10,
        fromDate: '2024-01-01T00:00:00.000Z',
        toDate: '2024-12-31T23:59:59.000Z',
      });
    });

    it('returns empty array when no notifications', async () => {
      mockRepository.findByUser.mockResolvedValue([]);

      const result = await service.getNotifications('user-1', { limit: 20 });

      expect(result).toEqual([]);
    });
  });

  describe('getUnreadCount', () => {
    it('delegates to repository', async () => {
      mockRepository.countUnread.mockResolvedValue(5);

      const result = await service.getUnreadCount('user-1');

      expect(mockRepository.countUnread).toHaveBeenCalledWith('user-1');
      expect(result).toBe(5);
    });

    it('returns 0 when no unread notifications', async () => {
      mockRepository.countUnread.mockResolvedValue(0);

      const result = await service.getUnreadCount('user-1');

      expect(result).toBe(0);
    });
  });

  describe('getNotification', () => {
    it('returns notification when found and owned by user', async () => {
      const notification = createNotification();
      mockRepository.findById.mockResolvedValue(notification);

      const result = await service.getNotification('notif-1', 'user-1');

      expect(result).toEqual(notification);
    });

    it('returns null when notification not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      const result = await service.getNotification('nonexistent', 'user-1');

      expect(result).toBeNull();
    });

    it('returns null when notification belongs to different user', async () => {
      const notification = createNotification({ userId: 'other-user' });
      mockRepository.findById.mockResolvedValue(notification);

      const result = await service.getNotification('notif-1', 'user-1');

      expect(result).toBeNull();
    });

    it('returns notification when requested by owner', async () => {
      const notification = createNotification({ userId: 'user-1' });
      mockRepository.findById.mockResolvedValue(notification);

      const result = await service.getNotification('notif-1', 'user-1');

      expect(result).not.toBeNull();
    });
  });

  describe('create', () => {
    it('creates notification via repository', async () => {
      const notification = createNotification();
      mockRepository.create.mockResolvedValue(notification);

      const result = await service.create({
        userId: 'user-1',
        type: 'achievement_earned',
        title: 'Achievement Earned',
        message: 'You earned a new achievement!',
      });

      expect(mockRepository.create).toHaveBeenCalledWith({
        userId: 'user-1',
        type: 'achievement_earned',
        title: 'Achievement Earned',
        message: 'You earned a new achievement!',
      });
      expect(result).toEqual(notification);
    });

    it('logs notification creation', async () => {
      const notification = createNotification();
      mockRepository.create.mockResolvedValue(notification);

      await service.create({
        userId: 'user-1',
        type: 'achievement_earned',
        title: 'Achievement Earned',
        message: 'You earned a new achievement!',
      });

      expect(mockLogger.info).toHaveBeenCalledWith({
        event: 'notification_created',
        notificationId: 'notif-1',
        userId: 'user-1',
        type: 'achievement_earned',
      });
    });

    it('includes metadata in creation', async () => {
      const notification = createNotification({
        metadata: { achievementId: 'badge-123' },
      });
      mockRepository.create.mockResolvedValue(notification);

      const result = await service.create({
        userId: 'user-1',
        type: 'badge_earned',
        title: 'Badge Earned',
        message: 'You earned a badge!',
        metadata: { achievementId: 'badge-123' },
      });

      expect(mockRepository.create).toHaveBeenCalled();
      expect(result.metadata).toEqual({ achievementId: 'badge-123' });
    });

    it('works without metadata', async () => {
      const notification = createNotification({ metadata: {} });
      mockRepository.create.mockResolvedValue(notification);

      const result = await service.create({
        userId: 'user-1',
        type: 'system_announcement',
        title: 'Maintenance',
        message: 'System maintenance scheduled',
      });

      expect(result.metadata).toEqual({});
    });
  });
});
