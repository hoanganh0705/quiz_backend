import { RankingPeriod } from './ranking.types';

export type GetTopMoversQuery = {
  period: RankingPeriod;
  limit: number;
};
