import { RankingPeriod } from './ranking.types';

export type GetMyRankMovementQuery = {
  userId: string;
  period: RankingPeriod;
};
