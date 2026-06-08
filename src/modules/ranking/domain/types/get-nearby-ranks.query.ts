import { RankingPeriod } from './ranking.types';

export type GetNearbyRanksQuery = {
  userId: string;
  period: RankingPeriod;
  radius: number;
};
