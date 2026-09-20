/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import type { PinoLogger } from 'nestjs-pino';
import { RankNotificationService } from './rank-notification.service';
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
  const service = new RankNotificationService(channelService, makeLogger());
  return { service, send };
}

describe('RankNotificationService', () => {
  it('sends a rank_achievement notification', async () => {
    const { service, send } = makeService();
    await service.notifyRankAchievement({
      userId: 'user-1',
      milestone: 'gold',
      rank: 5,
      period: 'weekly',
      percentile: 5,
    });
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        type: 'rank_achievement',
        metadata: expect.objectContaining({ milestone: 'gold' }),
      }),
    );
  });

  it('falls back to default title/body for unknown milestones', async () => {
    const { service, send } = makeService();
    await service.notifyRankAchievement({
      userId: 'user-1',
      milestone: 'unknown' as never,
      rank: 5,
      period: 'weekly',
      percentile: 5,
    });
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Rank Milestone!',
        body: 'You have achieved a new rank!',
      }),
    );
  });

  it('sends a rank_improvement notification', async () => {
    const { service, send } = makeService();
    await service.notifyRankImprovement({
      userId: 'user-1',
      previousRank: 10,
      newRank: 4,
      improvement: 6,
      period: 'weekly',
    });
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'rank_improvement',
        title: '+6 positions!',
        body: 'You moved from rank #10 to rank #4.',
      }),
    );
  });

  it('sends a period_winner notification with weekly label', async () => {
    const { service, send } = makeService();
    await service.notifyPeriodWinner({
      userId: 'user-1',
      isWeekly: true,
      period: 'weekly',
    });
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'period_winner',
        title: 'Weekly Winner!',
        body: 'Congratulations! You won the weekly ranking period.',
      }),
    );
  });

  it('sends a period_winner notification with monthly label', async () => {
    const { service, send } = makeService();
    await service.notifyPeriodWinner({
      userId: 'user-1',
      isWeekly: false,
      period: 'monthly',
    });
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'period_winner',
        title: 'Monthly Winner!',
        body: 'Congratulations! You won the monthly ranking period.',
      }),
    );
  });
});
