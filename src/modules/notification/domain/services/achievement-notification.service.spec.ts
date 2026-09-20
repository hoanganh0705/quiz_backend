import type { PinoLogger } from 'nestjs-pino';
import { AchievementNotificationService } from './achievement-notification.service';
import type { NotificationChannelService } from '../../infrastructure/adapters/notification-channel.service';

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

function makeService() {
  const send = jest.fn().mockResolvedValue(undefined);
  const channelService = { send } as unknown as NotificationChannelService;
  const service = new AchievementNotificationService(channelService, makeLogger());
  return { service, send };
}

describe('AchievementNotificationService', () => {
  it('sends an achievement_earned notification', async () => {
    const { service, send } = makeService();
    await service.notifyAchievementEarned({
      userId: 'user-1',
      achievementType: 'mastery',
      badgeType: 'js_master',
      badgeName: 'JS Master',
      badgeDescription: 'Master of JavaScript',
      category: 'quiz',
    });
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'achievement_earned',
        title: 'Achievement Unlocked!',
        body: 'You earned the "JS Master" badge!',
      }),
    );
  });

  it('sends a badge_unlocked notification', async () => {
    const { service, send } = makeService();
    await service.notifyBadgeUnlocked({
      userId: 'user-1',
      badgeType: 'quiz_hero',
      badgeName: 'Quiz Hero',
      category: 'quiz',
    });
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'badge_unlocked',
        title: 'Badge Unlocked!',
      }),
    );
  });

  it('sends a badge_revoked notification', async () => {
    const { service, send } = makeService();
    await service.notifyBadgeRevoked({
      userId: 'user-1',
      badgeId: 'b-1',
      badgeType: 'js_master',
      reason: 'fraud',
      revokedBy: 'admin-1',
    });
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'badge_revoked',
        title: 'Badge Revoked',
      }),
    );
  });

  it('sends a streak_milestone notification', async () => {
    const { service, send } = makeService();
    await service.notifyStreakMilestone({
      userId: 'user-1',
      streakDays: 30,
      milestone: 30,
    });
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'streak_milestone',
        title: 'Streak Milestone!',
        body: 'Amazing! You have maintained a 30-day streak!',
      }),
    );
  });
});
