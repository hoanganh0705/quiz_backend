import {
  RankingPeriod,
  enumToPeriod,
  getXpColumn,
  getRankColumn,
  getXpField,
  getRankFieldName,
  getResetColumn,
  calculatePercentile,
  getPercentileLabel,
  RANKING_CONSTANTS,
} from './ranking.types';
import { LeaderboardPeriodEnum, RankingPeriodEnum } from '../../dto/request/leaderboard-query.dto';

describe('enumToPeriod', () => {
  it('maps every RankingPeriodEnum value to its RankingPeriod counterpart', () => {
    expect(enumToPeriod(RankingPeriodEnum.DAILY)).toBe(RankingPeriod.DAILY);
    expect(enumToPeriod(RankingPeriodEnum.WEEKLY)).toBe(RankingPeriod.WEEKLY);
    expect(enumToPeriod(RankingPeriodEnum.MONTHLY)).toBe(RankingPeriod.MONTHLY);
    expect(enumToPeriod(RankingPeriodEnum.ALL_TIME)).toBe(RankingPeriod.ALL_TIME);
  });

  it('maps every LeaderboardPeriodEnum value to its RankingPeriod counterpart', () => {
    expect(enumToPeriod(LeaderboardPeriodEnum.WEEKLY)).toBe(RankingPeriod.WEEKLY);
    expect(enumToPeriod(LeaderboardPeriodEnum.MONTHLY)).toBe(RankingPeriod.MONTHLY);
    expect(enumToPeriod(LeaderboardPeriodEnum.ALL_TIME)).toBe(RankingPeriod.ALL_TIME);
  });

  it('throws for unknown period values', () => {
    expect(() => enumToPeriod('bogus' as unknown as RankingPeriodEnum)).toThrow(
      /Unknown period enum/,
    );
  });
});

describe('ranking period column helpers', () => {
  it('returns the snake_case column for each period (getXpColumn)', () => {
    expect(getXpColumn(RankingPeriod.DAILY)).toBe('daily_xp');
    expect(getXpColumn(RankingPeriod.WEEKLY)).toBe('weekly_xp');
    expect(getXpColumn(RankingPeriod.MONTHLY)).toBe('monthly_xp');
    expect(getXpColumn(RankingPeriod.ALL_TIME)).toBe('all_time_xp');
  });

  it('returns the snake_case column for each period (getRankColumn)', () => {
    expect(getRankColumn(RankingPeriod.DAILY)).toBe('daily_rank');
    expect(getRankColumn(RankingPeriod.WEEKLY)).toBe('weekly_rank');
    expect(getRankColumn(RankingPeriod.MONTHLY)).toBe('monthly_rank');
    expect(getRankColumn(RankingPeriod.ALL_TIME)).toBe('all_time_rank');
  });

  it('returns the camelCase field name for each period (getXpField)', () => {
    expect(getXpField(RankingPeriod.DAILY)).toBe('dailyXp');
    expect(getXpField(RankingPeriod.WEEKLY)).toBe('weeklyXp');
    expect(getXpField(RankingPeriod.MONTHLY)).toBe('monthlyXp');
    expect(getXpField(RankingPeriod.ALL_TIME)).toBe('allTimeXp');
  });

  it('returns the camelCase field name for each period (getRankFieldName)', () => {
    expect(getRankFieldName(RankingPeriod.DAILY)).toBe('dailyRank');
    expect(getRankFieldName(RankingPeriod.WEEKLY)).toBe('weeklyRank');
    expect(getRankFieldName(RankingPeriod.MONTHLY)).toBe('monthlyRank');
    expect(getRankFieldName(RankingPeriod.ALL_TIME)).toBe('allTimeRank');
  });

  it('returns the reset timestamp column for each period', () => {
    expect(getResetColumn(RankingPeriod.DAILY)).toBe('lastDailyResetAt');
    expect(getResetColumn(RankingPeriod.WEEKLY)).toBe('lastWeeklyResetAt');
    expect(getResetColumn(RankingPeriod.MONTHLY)).toBe('lastMonthlyResetAt');
    expect(getResetColumn(RankingPeriod.ALL_TIME)).toBe('updatedAt');
  });
});

describe('calculatePercentile', () => {
  it('returns 0 when rank or totalUsers is non-positive', () => {
    expect(calculatePercentile(0, 100)).toBe(0);
    expect(calculatePercentile(50, 0)).toBe(0);
    expect(calculatePercentile(-5, 100)).toBe(0);
  });

  it('returns ~100 when the user is the top entry', () => {
    expect(calculatePercentile(1, 100)).toBe(99);
  });

  it('returns the right percentile for a mid-table rank', () => {
    expect(calculatePercentile(50, 100)).toBe(50);
  });

  it('rounds the percentile to two decimals', () => {
    expect(calculatePercentile(1, 3)).toBe(66.67);
  });
});

describe('getPercentileLabel', () => {
  it('labels buckets in descending order', () => {
    expect(getPercentileLabel(99.5)).toBe(RANKING_CONSTANTS.PERCENTILE_LABELS[100]);
    expect(getPercentileLabel(96)).toBe(RANKING_CONSTANTS.PERCENTILE_LABELS[95]);
    expect(getPercentileLabel(91)).toBe(RANKING_CONSTANTS.PERCENTILE_LABELS[90]);
    expect(getPercentileLabel(76)).toBe(RANKING_CONSTANTS.PERCENTILE_LABELS[75]);
    expect(getPercentileLabel(60)).toBe(RANKING_CONSTANTS.PERCENTILE_LABELS[50]);
    expect(getPercentileLabel(10)).toBe(RANKING_CONSTANTS.PERCENTILE_LABELS[0]);
  });
});
