/**
 * Achievement Domain Types
 */

export enum BadgeType {
  RANK_1 = 'rank1',
  TOP_10 = 'top10',
  TOP_100 = 'top100',
  TOP_1000 = 'top1000',
  STREAK_7 = 'streak_7',
  STREAK_30 = 'streak_30',
  STREAK_100 = 'streak_100',
  NEWCOMER = 'newcomer',
  RISING_STAR = 'rising_star',
  VETERAN = 'veteran',
}

export interface RankAchievementParams {
  userId: string;
  period: string;
  currentRank: number;
  previousRank: number | null;
  xp: number;
}
