/**
 * Rank Notification Service
 *
 * Composes and sends rank-related notifications.
 */

import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  RANK_NOTIFICATION_TITLES,
  RANK_NOTIFICATION_BODIES,
  RankNotificationParams,
  RankImprovementParams,
  PeriodWinnerParams,
  NotificationType,
} from '../types/notification.types';
import { NotificationChannelService } from '../../infrastructure/adapters/notification-channel.service';

@Injectable()
export class RankNotificationService implements RankNotificationPort {
  constructor(
    private readonly channelService: NotificationChannelService,
    @InjectPinoLogger(RankNotificationService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Send a rank achievement notification.
   */
  async notifyRankAchievement(params: RankNotificationParams): Promise<void> {
    const title = RANK_NOTIFICATION_TITLES[params.milestone] ?? 'Rank Milestone!';
    const body = RANK_NOTIFICATION_BODIES[params.milestone] ?? 'You have achieved a new rank!';

    await this.sendNotification({
      userId: params.userId,
      type: 'rank_achievement',
      title,
      body,
      metadata: {
        rank: params.rank,
        period: params.period,
        milestone: params.milestone,
        percentile: params.percentile,
      },
    });

    this.logger.info({
      event: 'rank_achievement_notification_sent',
      userId: params.userId,
      milestone: params.milestone,
      rank: params.rank,
    });
  }

  /**
   * Send a rank improvement notification.
   */
  async notifyRankImprovement(params: RankImprovementParams): Promise<void> {
    const title = '+' + params.improvement + ' positions!';
    const body = `You moved from rank #${params.previousRank} to rank #${params.newRank}.`;

    await this.sendNotification({
      userId: params.userId,
      type: 'rank_improvement',
      title,
      body,
      metadata: {
        previousRank: params.previousRank,
        newRank: params.newRank,
        improvement: params.improvement,
        period: params.period,
      },
    });

    this.logger.info({
      event: 'rank_improvement_notification_sent',
      userId: params.userId,
      improvement: params.improvement,
    });
  }

  /**
   * Send a period winner notification.
   */
  async notifyPeriodWinner(params: PeriodWinnerParams): Promise<void> {
    const periodLabel = params.isWeekly ? 'Weekly' : 'Monthly';
    const title = periodLabel + ' Winner!';
    const body = `Congratulations! You won the ${periodLabel.toLowerCase()} ranking period.`;

    await this.sendNotification({
      userId: params.userId,
      type: 'period_winner',
      title,
      body,
      metadata: {
        period: params.period,
        isWeekly: params.isWeekly,
      },
    });

    this.logger.info({
      event: 'period_winner_notification_sent',
      userId: params.userId,
      period: params.period,
      isWeekly: params.isWeekly,
    });
  }

  private async sendNotification(params: {
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.channelService.send({
      userId: params.userId,
      type: params.type,
      title: params.title,
      body: params.body,
      metadata: params.metadata,
    });
  }
}

/**
 * Port interface exposed to the Ranking module via RANK_NOTIFICATION_PORT.
 */
export interface RankNotificationPort {
  notifyRankAchievement(params: RankNotificationParams): Promise<void>;
  notifyRankImprovement(params: RankImprovementParams): Promise<void>;
  notifyPeriodWinner(params: PeriodWinnerParams): Promise<void>;
}
