import { coinReason } from '@/core/database/schema/shared/enums';

export type CoinReason = (typeof coinReason.enumValues)[number];

export type CoinSource = 'attempt' | 'daily' | 'streak' | 'badge' | 'tournament';

export const DAILY_CAP_REASONS: ReadonlySet<CoinReason> = new Set<CoinReason>([
  'QUIZ_COMPLETION_REWARD',
  'QUIZ_PERFECT_BONUS',
]);
