import { RankingPeriod } from './ranking.types';

export type GetMyPercentileQuery = {
  userId: string;
  period: RankingPeriod;
};
