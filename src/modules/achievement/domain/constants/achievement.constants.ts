export const RARITY_THRESHOLDS = {
  COMMON: 1000,
  UNCOMMON: 500,
  RARE: 100,
  EPIC: 10,
} as const;

export const RARITY_THRESHOLD_MAP: Record<string, number> = {
  legendary: 0,
  epic: RARITY_THRESHOLDS.EPIC,
  rare: RARITY_THRESHOLDS.RARE,
  uncommon: RARITY_THRESHOLDS.UNCOMMON,
  common: RARITY_THRESHOLDS.COMMON,
} as const;

export const BADGE_THRESHOLDS = {
  RANK: {
    RANK_1: 1,
    TOP_10: 10,
    TOP_100: 100,
    TOP_1000: 1000,
  } as const,
  STREAK: {
    STREAK_7: 7,
    STREAK_30: 30,
    STREAK_100: 100,
  } as const,
} as const;

export const PROGRESS_MILESTONES = [10, 25, 50, 75, 100] as const;

export const ACHIEVEMENT_MILESTONES = [1, 5, 10, 25, 50, 100, 250, 500] as const;

export const SCHEDULED_EVALUATION = {
  DEFAULT_BATCH_SIZE: 100,
  DEFAULT_STAGGER_DELAY_MS: 10,
} as const;

export function computeRarityString(earnerCount: number): string {
  if (earnerCount >= RARITY_THRESHOLDS.COMMON) return 'common';
  if (earnerCount >= RARITY_THRESHOLDS.UNCOMMON) return 'uncommon';
  if (earnerCount >= RARITY_THRESHOLDS.RARE) return 'rare';
  if (earnerCount >= RARITY_THRESHOLDS.EPIC) return 'epic';
  return 'legendary';
}
