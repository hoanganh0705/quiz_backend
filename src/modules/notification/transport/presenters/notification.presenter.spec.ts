import { NotificationPresenter } from './notification.presenter';
import { paginated } from '@/common/responses/paginated-result';
import type { NotificationResponseDto } from '../../dto/response/notification-response.dto';

function makeNotification(
  overrides: Partial<NotificationResponseDto> = {},
): NotificationResponseDto {
  return {
    notificationId: 'n-1',
    userId: 'user-1',
    type: 'achievement_earned',
    title: 'T',
    message: 'M',
    metadata: null,
    channel: 'in_app',
    isRead: false,
    readAt: null,
    createdAt: '2025-06-01T10:00:00.000Z',
    expiresAt: null,
    ...overrides,
  };
}

describe('NotificationPresenter', () => {
  const presenter = new NotificationPresenter();

  it('wraps a paginated list', () => {
    const list = paginated<NotificationResponseDto>([makeNotification()], {
      kind: 'cursor',
      limit: 20,
      hasNextPage: false,
      nextCursor: null,
    });
    const envelope = presenter.getNotifications(list);
    expect(envelope.data).toHaveLength(1);
    expect(envelope.meta.pagination).toEqual({
      kind: 'cursor',
      limit: 20,
      hasNextPage: false,
      nextCursor: null,
    });
  });

  it('wraps unread count', () => {
    const envelope = presenter.getUnreadCount({ count: 5 });
    expect(envelope.data).toEqual({ count: 5 });
  });

  it('wraps analytics', () => {
    const analytics = {
      total: 100,
      unread: 5,
      byType: { achievement_earned: 50 },
      byChannel: { in_app: 90 },
      last24h: 10,
      last7d: 50,
    };
    const envelope = presenter.getAnalytics(analytics);
    expect(envelope.data).toEqual(analytics);
  });

  it('wraps preferences get', () => {
    const prefs = {
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
    };
    const envelope = presenter.getPreferences(prefs);
    expect(envelope.data).toEqual(prefs);
  });

  it('wraps preferences update', () => {
    const prefs = {
      inAppEnabled: false,
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
    };
    const envelope = presenter.updatePreferences(prefs);
    expect(envelope.data).toEqual(prefs);
  });

  it('wraps notification detail', () => {
    const notification = makeNotification({ notificationId: 'n-2' });
    const envelope = presenter.getNotificationDetail(notification);
    expect(envelope.data).toEqual(notification);
  });
});
