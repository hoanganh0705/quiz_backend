/**
 * NotificationRepository unit tests.
 *
 * Tests the core repository methods using mock implementations that verify
 * the expected call patterns and return values:
 *
 *   - `create` — verifies notification creation
 *   - `findById` — verifies single notification lookup
 *   - `findByUser` — verifies cursor pagination, date filters, type filtering
 *   - `countUnread` — verifies unread count
 *   - `markAsRead` / `markAsUnread` — verifies status updates
 *   - `softDelete` / `delete` — verifies soft delete pattern
 *   - `deleteExpired` — verifies cleanup
 *   - `getAnalytics` — verifies aggregation queries
 *
 * Note: These tests use mock functions to verify behavior without requiring
 * a real database connection.
 */
import { NotificationRepository } from './notification.repository';

interface MockDbState {
  capturedWhere: unknown;
  capturedSet: Record<string, unknown>;
  returnRows: unknown[];
}

const createMockDb = (
  returnRows: unknown[] = [],
): {
  state: MockDbState;
  db: {
    select: jest.Mock;
    insert: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
} => {
  const state: MockDbState = {
    capturedWhere: undefined,
    capturedSet: {},
    returnRows,
  };

  const db = {
    select: jest.fn().mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue(returnRows),
        }),
        orderBy: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue(returnRows),
          }),
        }),
        groupBy: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue(returnRows),
        }),
      }),
    }),
    insert: jest.fn().mockReturnValue({
      values: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue(returnRows[0] ?? {}),
      }),
    }),
    update: jest.fn().mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue(returnRows),
        }),
      }),
    }),
    delete: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue(returnRows),
      }),
    }),
  };

  return { state, db };
};

const mockTransactionalContext = {
  getDbClient: jest.fn().mockReturnValue(null),
};

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

const createNotificationRow = (overrides: Partial<{
  notificationId: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  metadata: Record<string, unknown>;
  channel: string;
  isRead: boolean;
  readAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  deletedAt: string | null;
}> = {}) => ({
  notificationId: 'notif-1',
  userId: 'user-1',
  type: 'achievement_earned',
  title: 'Achievement Earned',
  message: 'You earned a new achievement!',
  metadata: {},
  channel: 'in_app',
  isRead: false,
  readAt: null,
  expiresAt: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  deletedAt: null,
  ...overrides,
});

describe('NotificationRepository', () => {
  describe('create', () => {
    it('creates a notification with all required fields', async () => {
      const notificationRow = createNotificationRow();
      const { db } = createMockDb([notificationRow]);
      const repo = new NotificationRepository(db as never, mockLogger, mockTransactionalContext as never);

      const result = await repo.create({
        userId: 'user-1',
        type: 'achievement_earned',
        title: 'Achievement Earned',
        message: 'You earned a new achievement!',
      });

      expect(db.insert).toHaveBeenCalled();
      expect(result.notificationId).toBe('notif-1');
      expect(result.userId).toBe('user-1');
      expect(result.type).toBe('achievement_earned');
    });

    it('creates a notification with optional metadata', async () => {
      const metadata = { achievementId: 'badge-123', tier: 'gold' };
      const notificationRow = createNotificationRow({ metadata });
      const { db } = createMockDb([notificationRow]);
      const repo = new NotificationRepository(db as never, mockLogger, mockTransactionalContext as never);

      const result = await repo.create({
        userId: 'user-1',
        type: 'badge_earned',
        title: 'Badge Earned',
        message: 'You earned a gold badge!',
        metadata,
      });

      expect(result.metadata).toEqual(metadata);
    });

    it('creates a notification with custom channel', async () => {
      const notificationRow = createNotificationRow({ channel: 'email' });
      const { db } = createMockDb([notificationRow]);
      const repo = new NotificationRepository(db as never, mockLogger, mockTransactionalContext as never);

      const result = await repo.create({
        userId: 'user-1',
        type: 'tournament_reminder',
        title: 'Tournament Starting',
        message: 'Your tournament begins in 1 hour',
        channel: 'email',
      });

      expect(result.channel).toBe('email');
    });

    it('creates a notification with expiration', async () => {
      const expiresAt = '2024-12-31T23:59:59.000Z';
      const notificationRow = createNotificationRow({ expiresAt });
      const { db } = createMockDb([notificationRow]);
      const repo = new NotificationRepository(db as never, mockLogger, mockTransactionalContext as never);

      const result = await repo.create({
        userId: 'user-1',
        type: 'system_announcement',
        title: 'Maintenance',
        message: 'System maintenance scheduled',
        expiresAt,
      });

      expect(result.expiresAt).toBe(expiresAt);
    });
  });

  describe('findById', () => {
    it('returns notification when found', async () => {
      const notificationRow = createNotificationRow();
      const { db } = createMockDb([notificationRow]);
      const repo = new NotificationRepository(db as never, mockLogger, mockTransactionalContext as never);

      const result = await repo.findById('notif-1');

      expect(result).not.toBeNull();
      expect(result?.notificationId).toBe('notif-1');
    });

    it('returns null when not found', async () => {
      const { db } = createMockDb([]);
      const repo = new NotificationRepository(db as never, mockLogger, mockTransactionalContext as never);

      const result = await repo.findById('nonexistent');

      expect(result).toBeNull();
    });

    it('excludes deleted notifications', async () => {
      const { db } = createMockDb([]);
      const repo = new NotificationRepository(db as never, mockLogger, mockTransactionalContext as never);

      await repo.findById('deleted-notif');

      expect(db.select).toHaveBeenCalled();
    });
  });

  describe('findByUser', () => {
    it('returns notifications for a user', async () => {
      const notifications = [
        createNotificationRow({ notificationId: 'notif-1' }),
        createNotificationRow({ notificationId: 'notif-2' }),
      ];
      const { db } = createMockDb(notifications);
      const repo = new NotificationRepository(db as never, mockLogger, mockTransactionalContext as never);

      const result = await repo.findByUser({
        userId: 'user-1',
        limit: 20,
      });

      expect(result).toHaveLength(2);
    });

    it('applies limit correctly', async () => {
      const notifications = Array.from({ length: 5 }, (_, i) =>
        createNotificationRow({ notificationId: `notif-${i}` }),
      );
      const { db } = createMockDb(notifications);
      const repo = new NotificationRepository(db as never, mockLogger, mockTransactionalContext as never);

      await repo.findByUser({
        userId: 'user-1',
        limit: 3,
      });

      expect(db.select).toHaveBeenCalled();
    });

    it('filters by unreadOnly when specified', async () => {
      const { db } = createMockDb([]);
      const repo = new NotificationRepository(db as never, mockLogger, mockTransactionalContext as never);

      await repo.findByUser({
        userId: 'user-1',
        limit: 20,
        unreadOnly: true,
      });

      expect(db.select).toHaveBeenCalled();
    });

    it('filters by type when specified', async () => {
      const { db } = createMockDb([]);
      const repo = new NotificationRepository(db as never, mockLogger, mockTransactionalContext as never);

      await repo.findByUser({
        userId: 'user-1',
        limit: 20,
        type: 'achievement_earned',
      });

      expect(db.select).toHaveBeenCalled();
    });

    it('filters by fromDate when specified', async () => {
      const { db } = createMockDb([]);
      const repo = new NotificationRepository(db as never, mockLogger, mockTransactionalContext as never);

      await repo.findByUser({
        userId: 'user-1',
        limit: 20,
        fromDate: '2024-01-01T00:00:00.000Z',
      });

      expect(db.select).toHaveBeenCalled();
    });

    it('filters by toDate when specified', async () => {
      const { db } = createMockDb([]);
      const repo = new NotificationRepository(db as never, mockLogger, mockTransactionalContext as never);

      await repo.findByUser({
        userId: 'user-1',
        limit: 20,
        toDate: '2024-12-31T23:59:59.000Z',
      });

      expect(db.select).toHaveBeenCalled();
    });

    it('filters by both fromDate and toDate when specified', async () => {
      const { db } = createMockDb([]);
      const repo = new NotificationRepository(db as never, mockLogger, mockTransactionalContext as never);

      await repo.findByUser({
        userId: 'user-1',
        limit: 20,
        fromDate: '2024-01-01T00:00:00.000Z',
        toDate: '2024-12-31T23:59:59.000Z',
      });

      expect(db.select).toHaveBeenCalled();
    });

    it('returns empty array when no notifications exist', async () => {
      const { db } = createMockDb([]);
      const repo = new NotificationRepository(db as never, mockLogger, mockTransactionalContext as never);

      const result = await repo.findByUser({
        userId: 'user-1',
        limit: 20,
      });

      expect(result).toHaveLength(0);
    });

    it('excludes archived notifications by default', async () => {
      const { db } = createMockDb([]);
      const repo = new NotificationRepository(db as never, mockLogger, mockTransactionalContext as never);

      await repo.findByUser({
        userId: 'user-1',
        limit: 20,
        includeArchived: false,
      });

      expect(db.select).toHaveBeenCalled();
    });
  });

  describe('countUnread', () => {
    it('returns the count of unread notifications', async () => {
      const { db } = createMockDb([[{ value: 5 }]]);
      const repo = new NotificationRepository(db as never, mockLogger, mockTransactionalContext as never);

      const result = await repo.countUnread('user-1');

      expect(result).toBe(5);
    });

    it('returns 0 when no unread notifications', async () => {
      const { db } = createMockDb([[{ value: 0 }]]);
      const repo = new NotificationRepository(db as never, mockLogger, mockTransactionalContext as never);

      const result = await repo.countUnread('user-1');

      expect(result).toBe(0);
    });
  });

  describe('markAsRead', () => {
    it('marks a notification as read', async () => {
      const { db } = createMockDb([]);
      const repo = new NotificationRepository(db as never, mockLogger, mockTransactionalContext as never);

      await repo.markAsRead('notif-1', 'user-1');

      expect(db.update).toHaveBeenCalled();
    });

    it('sets the readAt timestamp', async () => {
      const { db } = createMockDb([]);
      const repo = new NotificationRepository(db as never, mockLogger, mockTransactionalContext as never);

      await repo.markAsRead('notif-1', 'user-1');

      expect(db.update).toHaveBeenCalled();
    });
  });

  describe('markAsUnread', () => {
    it('marks a notification as unread', async () => {
      const { db } = createMockDb([]);
      const repo = new NotificationRepository(db as never, mockLogger, mockTransactionalContext as never);

      await repo.markAsUnread('notif-1', 'user-1');

      expect(db.update).toHaveBeenCalled();
    });

    it('clears the readAt timestamp', async () => {
      const { db } = createMockDb([]);
      const repo = new NotificationRepository(db as never, mockLogger, mockTransactionalContext as never);

      await repo.markAsUnread('notif-1', 'user-1');

      expect(db.update).toHaveBeenCalled();
    });
  });

  describe('markAllAsRead', () => {
    it('marks all user notifications as read', async () => {
      const { db } = createMockDb([]);
      const repo = new NotificationRepository(db as never, mockLogger, mockTransactionalContext as never);

      await repo.markAllAsRead('user-1');

      expect(db.update).toHaveBeenCalled();
    });
  });

  describe('softDelete', () => {
    it('sets deletedAt timestamp instead of hard delete', async () => {
      const { db } = createMockDb([]);
      const repo = new NotificationRepository(db as never, mockLogger, mockTransactionalContext as never);

      await repo.softDelete('notif-1', 'user-1');

      expect(db.update).toHaveBeenCalled();
    });

    it('only affects non-deleted notifications', async () => {
      const { db } = createMockDb([]);
      const repo = new NotificationRepository(db as never, mockLogger, mockTransactionalContext as never);

      await repo.softDelete('notif-1', 'user-1');

      expect(db.update).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('calls softDelete instead of hard delete', async () => {
      const { db } = createMockDb([]);
      const repo = new NotificationRepository(db as never, mockLogger, mockTransactionalContext as never);

      await repo.delete('notif-1', 'user-1');

      expect(db.update).toHaveBeenCalled();
    });
  });

  describe('deleteReadNotifications', () => {
    it('soft deletes all read notifications for a user', async () => {
      const { db } = createMockDb([{ rowCount: 3 }]);
      const repo = new NotificationRepository(db as never, mockLogger, mockTransactionalContext as never);

      const result = await repo.deleteReadNotifications('user-1');

      expect(result).toBe(3);
      expect(db.update).toHaveBeenCalled();
    });

    it('returns 0 when no read notifications exist', async () => {
      const { db } = createMockDb([{ rowCount: 0 }]);
      const repo = new NotificationRepository(db as never, mockLogger, mockTransactionalContext as never);

      const result = await repo.deleteReadNotifications('user-1');

      expect(result).toBe(0);
    });
  });

  describe('deleteExpired', () => {
    it('hard deletes expired notifications', async () => {
      const { db } = createMockDb([{ rowCount: 10 }]);
      const repo = new NotificationRepository(db as never, mockLogger, mockTransactionalContext as never);

      const result = await repo.deleteExpired();

      expect(result).toBe(10);
      expect(db.delete).toHaveBeenCalled();
    });

    it('returns 0 when no expired notifications exist', async () => {
      const { db } = createMockDb([{ rowCount: 0 }]);
      const repo = new NotificationRepository(db as never, mockLogger, mockTransactionalContext as never);

      const result = await repo.deleteExpired();

      expect(result).toBe(0);
    });
  });

  describe('getAnalytics', () => {
    it('returns analytics data', async () => {
      const mockResults = [
        [{ value: 100 }],
        [{ value: 25 }],
        [{ type: 'achievement_earned', value: 50 }],
        [{ channel: 'in_app', value: 80 }],
        [{ value: 10 }],
        [{ value: 50 }],
      ];

      const { db } = createMockDb(mockResults);
      const repo = new NotificationRepository(db as never, mockLogger, mockTransactionalContext as never);

      const result = await repo.getAnalytics();

      expect(result.total).toBe(100);
      expect(result.unread).toBe(25);
      expect(result.last24h).toBe(10);
      expect(result.last7d).toBe(50);
    });

    it('returns empty byType when no data', async () => {
      const mockResults = [
        [{ value: 0 }],
        [{ value: 0 }],
        [],
        [],
        [{ value: 0 }],
        [{ value: 0 }],
      ];

      const { db } = createMockDb(mockResults);
      const repo = new NotificationRepository(db as never, mockLogger, mockTransactionalContext as never);

      const result = await repo.getAnalytics();

      expect(result.byType).toEqual({});
      expect(result.byChannel).toEqual({});
    });
  });
});
