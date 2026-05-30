/**
 * Notification Port
 *
 * Interface for notification services.
 * Ranking domain emits events; notification domain decides when to notify.
 */

export const NOTIFICATION_PORT = Symbol('NOTIFICATION_PORT');

export interface NotificationPort {
  /**
   * Send a rank achievement notification.
   */
  notifyRankAchievement(params: {
    userId: string;
    rank: number;
    period: string;
    milestone: 'top10' | 'top100' | 'top1000' | 'rank1';
    percentile: number;
  }): Promise<void>;

  /**
   * Send a rank improvement notification.
   */
  notifyRankImprovement(params: {
    userId: string;
    previousRank: number;
    newRank: number;
    period: string;
    improvement: number;
  }): Promise<void>;

  /**
   * Send a period winner notification.
   */
  notifyPeriodWinner(params: { userId: string; period: string; isWeekly: boolean }): Promise<void>;
}
