import { RankingPeriod } from './ranking.types';

export type GetUserRankingHistoryQuery = {
  targetUserId: string;
  period: RankingPeriod;
  from?: Date;
  to?: Date;
};
