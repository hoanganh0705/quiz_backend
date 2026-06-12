/**
 * Achievement Constants
 *
 * Centralized threshold values for badge eligibility and rarity classification.
 * All hardcoded numeric thresholds should reference these constants.
 */

export const RARITY_THRESHOLDS = {
  /** Earners needed for a badge to be classified as "common" */
  COMMON: 1000,
  /** Earners needed for a badge to be classified as "uncommon" */
  UNCOMMON: 500,
  /** Earners needed for a badge to be classified as "rare" */
  RARE: 100,
  /** Earners needed for a badge to be classified as "epic" */
  EPIC: 10,
} as const;

/** Maps a RarityTier key to the minimum earner count required. */
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

/** Milestone percentage points for multi-step achievement progress bars. */
export const PROGRESS_MILESTONES = [10, 25, 50, 75, 100] as const;

/** Achievement milestones for user badge counts (used in analytics). */
export const ACHIEVEMENT_MILESTONES = [1, 5, 10, 25, 50, 100, 250, 500] as const;

/** Batch processing configuration for scheduled evaluation. */
export const SCHEDULED_EVALUATION = {
  DEFAULT_BATCH_SIZE: 100,
  DEFAULT_STAGGER_DELAY_MS: 10,
} as const;

/**
 * Maps an earner count to its rarity string label.
 * All rarity computations must route through this function — never inline thresholds.
 */
export function computeRarityString(earnerCount: number): string {
  if (earnerCount >= RARITY_THRESHOLDS.COMMON) return 'common';
  if (earnerCount >= RARITY_THRESHOLDS.UNCOMMON) return 'uncommon';
  if (earnerCount >= RARITY_THRESHOLDS.RARE) return 'rare';
  if (earnerCount >= RARITY_THRESHOLDS.EPIC) return 'epic';
  return 'legendary';
}
