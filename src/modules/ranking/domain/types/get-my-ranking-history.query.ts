import { RankingPeriod } from './ranking.types';

export type GetMyRankingHistoryQuery = {
  userId: string;
  period: RankingPeriod;
  from?: Date;
  to?: Date;
};
