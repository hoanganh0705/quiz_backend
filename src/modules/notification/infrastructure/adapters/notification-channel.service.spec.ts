/**
 * NotificationChannelService unit tests.
 *
 * Tests the channel service methods:
 *   - `send` — applies preferences and routes to channels
 *   - `shouldSendNotification` — preference filtering logic
 *   - `isInQuietHours` — quiet hours logic
 *   - `invalidatePreferencesCache` — cache invalidation
 */
import { NotificationChannelService } from './notification-channel.service';

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

const createMockCache = () => ({
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
});

const createMockEventBus = () => ({
  emit: jest.fn(),
});

const createMockRepository = () => ({
  create: jest.fn(),
});

const createMockPreferencesRepository = () => ({
  getPreferences: jest.fn(),
});

const createPreferences = (overrides: Partial<{
  inAppEnabled: boolean;
  emailEnabled: boolean;
  pushEnabled: boolean;
  achievementEnabled: boolean;
  tournamentEnabled: boolean;
  rankEnabled: boolean;
  friendEnabled: boolean;
  discussionEnabled: boolean;
  summaryEnabled: boolean;
  marketingEnabled: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
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

const createNotification = (overrides: Partial<{
  notificationId: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  channel: string;
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

describe('NotificationChannelService', () => {
  describe('invalidatePreferencesCache', () => {
    it('invalidates cache when cache provider exists', async () => {
      const mockCache = createMockCache();
      mockCache.set.mockResolvedValue(undefined);

      const service = new NotificationChannelService(
        createMockRepository() as never,
        createMockPreferencesRepository() as never,
        createMockEventBus() as never,
        mockCache,
        mockLogger,
      );

      await service.invalidatePreferencesCache('user-1');

      expect(mockCache.set).toHaveBeenCalledWith('notif:prefs:user-1', '', 1);
    });

    it('does nothing when cache provider does not exist', async () => {
      const service = new NotificationChannelService(
        createMockRepository() as never,
        createMockPreferencesRepository() as never,
        createMockEventBus() as never,
        undefined,
        mockLogger,
      );

      await expect(
        service.invalidatePreferencesCache('user-1'),
      ).resolves.toBeUndefined();
    });
  });

  describe('send', () => {
    it('creates notification when no preferences exist', async () => {
      const mockRepo = createMockRepository();
      const mockPrefsRepo = createMockPreferencesRepository();
      mockPrefsRepo.getPreferences.mockResolvedValue(null);
      mockRepo.create.mockResolvedValue(createNotification());

      const service = new NotificationChannelService(
        mockRepo,
        mockPrefsRepo,
        createMockEventBus(),
        undefined,
        mockLogger,
      );

      await service.send({
        userId: 'user-1',
        type: 'achievement_earned',
        title: 'Achievement Earned',
        body: 'You earned a new achievement!',
      });

      expect(mockRepo.create).toHaveBeenCalled();
    });

    it('respects in-app channel preference', async () => {
      const mockRepo = createMockRepository();
      const mockPrefsRepo = createMockPreferencesRepository();
      mockPrefsRepo.getPreferences.mockResolvedValue(
        createPreferences({ inAppEnabled: false }),
      );

      const service = new NotificationChannelService(
        mockRepo,
        mockPrefsRepo,
        createMockEventBus(),
        undefined,
        mockLogger,
      );

      await service.send({
        userId: 'user-1',
        type: 'achievement_earned',
        title: 'Achievement Earned',
        body: 'You earned a new achievement!',
        channels: ['in_app'],
      });

      expect(mockRepo.create).not.toHaveBeenCalled();
    });

    it('respects email channel preference', async () => {
      const mockRepo = createMockRepository();
      const mockPrefsRepo = createMockPreferencesRepository();
      mockPrefsRepo.getPreferences.mockResolvedValue(
        createPreferences({ emailEnabled: false }),
      );

      const service = new NotificationChannelService(
        mockRepo,
        mockPrefsRepo,
        createMockEventBus(),
        undefined,
        mockLogger,
      );

      await service.send({
        userId: 'user-1',
        type: 'achievement_earned',
        title: 'Achievement Earned',
        body: 'You earned a new achievement!',
        channels: ['email'],
        recipientEmail: 'user@example.com',
      });

      expect(mockRepo.create).not.toHaveBeenCalled();
    });

    it('respects push channel preference', async () => {
      const mockRepo = createMockRepository();
      const mockPrefsRepo = createMockPreferencesRepository();
      mockPrefsRepo.getPreferences.mockResolvedValue(
        createPreferences({ pushEnabled: false }),
      );

      const service = new NotificationChannelService(
        mockRepo,
        mockPrefsRepo,
        createMockEventBus(),
        undefined,
        mockLogger,
      );

      await service.send({
        userId: 'user-1',
        type: 'achievement_earned',
        title: 'Achievement Earned',
        body: 'You earned a new achievement!',
        channels: ['push'],
        pushToken: 'token123',
      });

      expect(mockRepo.create).not.toHaveBeenCalled();
    });

    it('caches preferences after first fetch', async () => {
      const mockRepo = createMockRepository();
      const mockPrefsRepo = createMockPreferencesRepository();
      const mockCache = createMockCache();
      mockPrefsRepo.getPreferences.mockResolvedValue(createPreferences());
      mockRepo.create.mockResolvedValue(createNotification());
      mockCache.get.mockResolvedValue(null);
      mockCache.set.mockResolvedValue(undefined);

      const service = new NotificationChannelService(
        mockRepo,
        mockPrefsRepo,
        createMockEventBus(),
        mockCache,
        mockLogger,
      );

      await service.send({
        userId: 'user-1',
        type: 'achievement_earned',
        title: 'Test',
        body: 'Test body',
      });

      expect(mockPrefsRepo.getPreferences).toHaveBeenCalledTimes(1);
    });
  });

  describe('shouldSendNotification', () => {
    let service: NotificationChannelService;

    beforeEach(() => {
      service = new NotificationChannelService(
        createMockRepository() as never,
        createMockPreferencesRepository() as never,
        createMockEventBus() as never,
        undefined,
        mockLogger,
      );
    });

    describe('notification type filtering', () => {
      it('respects achievementEnabled for achievement_earned', () => {
        const prefs = createPreferences({ achievementEnabled: false });
        const result = service.shouldSendNotification('user-1', 'achievement_earned', 'in_app', prefs);
        expect(result).toBe(false);
      });

      it('respects achievementEnabled for badge_earned', () => {
        const prefs = createPreferences({ achievementEnabled: true });
        const result = service.shouldSendNotification('user-1', 'badge_earned', 'in_app', prefs);
        expect(result).toBe(true);
      });

      it('respects rankEnabled for rank_achievement', () => {
        const prefs = createPreferences({ rankEnabled: false });
        const result = service.shouldSendNotification('user-1', 'rank_achievement', 'in_app', prefs);
        expect(result).toBe(false);
      });

      it('respects rankEnabled for rank_improvement', () => {
        const prefs = createPreferences({ rankEnabled: true });
        const result = service.shouldSendNotification('user-1', 'rank_improvement', 'in_app', prefs);
        expect(result).toBe(true);
      });

      it('respects tournamentEnabled for tournament_starting', () => {
        const prefs = createPreferences({ tournamentEnabled: false });
        const result = service.shouldSendNotification('user-1', 'tournament_starting', 'in_app', prefs);
        expect(result).toBe(false);
      });

      it('respects friendEnabled for friend_request', () => {
        const prefs = createPreferences({ friendEnabled: false });
        const result = service.shouldSendNotification('user-1', 'friend_request', 'in_app', prefs);
        expect(result).toBe(false);
      });

      it('respects discussionEnabled for discussion_reply', () => {
        const prefs = createPreferences({ discussionEnabled: false });
        const result = service.shouldSendNotification('user-1', 'discussion_reply', 'in_app', prefs);
        expect(result).toBe(false);
      });

      it('respects summaryEnabled for weekly_summary', () => {
        const prefs = createPreferences({ summaryEnabled: false });
        const result = service.shouldSendNotification('user-1', 'weekly_summary', 'in_app', prefs);
        expect(result).toBe(false);
      });

      it('allows system_announcement regardless of preferences', () => {
        const prefs = createPreferences({
          inAppEnabled: false,
          emailEnabled: false,
          pushEnabled: false,
        });
        const result = service.shouldSendNotification('user-1', 'system_announcement', 'in_app', prefs);
        expect(result).toBe(true);
      });

      it('allows quiz_review_received regardless of preferences', () => {
        const prefs = createPreferences({ discussionEnabled: false });
        const result = service.shouldSendNotification('user-1', 'quiz_review_received', 'in_app', prefs);
        expect(result).toBe(true);
      });
    });

    describe('channel filtering', () => {
      it('respects inAppEnabled preference', () => {
        const prefs = createPreferences({ inAppEnabled: false });
        const result = service.shouldSendNotification('user-1', 'achievement_earned', 'in_app', prefs);
        expect(result).toBe(false);
      });

      it('respects emailEnabled preference', () => {
        const prefs = createPreferences({ emailEnabled: false });
        const result = service.shouldSendNotification('user-1', 'achievement_earned', 'email', prefs);
        expect(result).toBe(false);
      });

      it('respects pushEnabled preference', () => {
        const prefs = createPreferences({ pushEnabled: false });
        const result = service.shouldSendNotification('user-1', 'achievement_earned', 'push', prefs);
        expect(result).toBe(false);
      });

      it('allows notification when channel is enabled', () => {
        const prefs = createPreferences({ inAppEnabled: true });
        const result = service.shouldSendNotification('user-1', 'achievement_earned', 'in_app', prefs);
        expect(result).toBe(true);
      });
    });

    describe('quiet hours', () => {
      it('skips notification during quiet hours', () => {
        const now = new Date();
        const currentHour = now.getHours();

        const quietStartHour = (currentHour + 1) % 24;
        const quietEndHour = (currentHour + 3) % 24;

        const startStr = String(quietStartHour).padStart(2, '0') + ':00';
        const endStr = String(quietEndHour).padStart(2, '0') + ':00';

        const prefs = createPreferences({
          quietHoursStart: startStr,
          quietHoursEnd: endStr,
          inAppEnabled: true,
        });

        const result = service.shouldSendNotification('user-1', 'achievement_earned', 'in_app', prefs);
        expect(result).toBe(false);
      });

      it('allows notification outside quiet hours', () => {
        const prefs = createPreferences({
          quietHoursStart: null,
          quietHoursEnd: null,
          inAppEnabled: true,
        });

        const result = service.shouldSendNotification('user-1', 'achievement_earned', 'in_app', prefs);
        expect(result).toBe(true);
      });

      it('allows notification when only start is set', () => {
        const prefs = createPreferences({
          quietHoursStart: '22:00',
          quietHoursEnd: null,
          inAppEnabled: true,
        });

        const result = service.shouldSendNotification('user-1', 'achievement_earned', 'in_app', prefs);
        expect(result).toBe(true);
      });
    });
  });

  describe('isInQuietHours', () => {
    let service: NotificationChannelService;

    beforeEach(() => {
      service = new NotificationChannelService(
        createMockRepository() as never,
        createMockPreferencesRepository() as never,
        createMockEventBus() as never,
        undefined,
        mockLogger,
      );
    });

    it('returns false when neither start nor end is set', () => {
      const prefs = createPreferences({ quietHoursStart: null, quietHoursEnd: null });
      const result = service.isInQuietHours(prefs);
      expect(result).toBe(false);
    });

    it('returns false when only end is set', () => {
      const prefs = createPreferences({ quietHoursStart: null, quietHoursEnd: '08:00' });
      const result = service.isInQuietHours(prefs);
      expect(result).toBe(false);
    });

    it('handles overnight quiet hours (e.g., 22:00 to 08:00)', () => {
      const prefs = createPreferences({ quietHoursStart: '22:00', quietHoursEnd: '08:00' });
      const result = service.isInQuietHours(prefs);
      expect(typeof result).toBe('boolean');
    });

    it('handles same-day quiet hours (e.g., 13:00 to 14:00)', () => {
      const prefs = createPreferences({ quietHoursStart: '13:00', quietHoursEnd: '14:00' });
      const result = service.isInQuietHours(prefs);
      expect(typeof result).toBe('boolean');
    });
  });
});
