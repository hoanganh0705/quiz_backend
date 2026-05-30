/**
 * Achievement Domain Types
 */

// ============================================
// ENUMS
// ============================================

export enum BadgeType {
  // Rank-based badges
  RANK_1 = 'rank1',
  TOP_10 = 'top10',
  TOP_100 = 'top100',
  TOP_1000 = 'top1000',

  // Consistency badges
  STREAK_7 = 'streak_7',
  STREAK_30 = 'streak_30',
  STREAK_100 = 'streak_100',

  // Milestone badges
  NEWCOMER = 'newcomer',
  RISING_STAR = 'rising_star',
  VETERAN = 'veteran',
}

export enum AchievementCategory {
  RANK = 'rank',
  CONSISTENCY = 'consistency',
  MILESTONE = 'milestone',
}

// ============================================
// TYPES
// ============================================

export interface BadgeDefinition {
  type: BadgeType;
  category: AchievementCategory;
  name: string;
  description: string;
  iconUrl?: string;
}

export interface UserBadge {
  userId: string;
  badgeType: BadgeType;
  awardedAt: Date;
  metadata?: Record<string, unknown>;
}

export interface RankAchievementParams {
  userId: string;
  period: string;
  currentRank: number;
  previousRank: number | null;
  xp: number;
}

export interface ConsistencyBadgeParams {
  userId: string;
  streakDays: number;
}

export interface MilestoneBadgeParams {
  userId: string;
  badgeType: 'rising_star' | 'veteran' | 'newcomer';
}

// ============================================
// CONSTANTS
// ============================================

export const BADGE_DEFINITIONS: Record<BadgeType, BadgeDefinition> = {
  [BadgeType.RANK_1]: {
    type: BadgeType.RANK_1,
    category: AchievementCategory.RANK,
    name: 'Champion',
    description: 'Reached rank #1 in a ranking period',
  },
  [BadgeType.TOP_10]: {
    type: BadgeType.TOP_10,
    category: AchievementCategory.RANK,
    name: 'Elite',
    description: 'Reached top 10 in a ranking period',
  },
  [BadgeType.TOP_100]: {
    type: BadgeType.TOP_100,
    category: AchievementCategory.RANK,
    name: 'Expert',
    description: 'Reached top 100 in a ranking period',
  },
  [BadgeType.TOP_1000]: {
    type: BadgeType.TOP_1000,
    category: AchievementCategory.RANK,
    name: 'Advanced',
    description: 'Reached top 1000 in a ranking period',
  },
  [BadgeType.STREAK_7]: {
    type: BadgeType.STREAK_7,
    category: AchievementCategory.CONSISTENCY,
    name: 'Week Warrior',
    description: 'Active for 7 consecutive days',
  },
  [BadgeType.STREAK_30]: {
    type: BadgeType.STREAK_30,
    category: AchievementCategory.CONSISTENCY,
    name: 'Monthly Master',
    description: 'Active for 30 consecutive days',
  },
  [BadgeType.STREAK_100]: {
    type: BadgeType.STREAK_100,
    category: AchievementCategory.CONSISTENCY,
    name: 'Centurion',
    description: 'Active for 100 consecutive days',
  },
  [BadgeType.NEWCOMER]: {
    type: BadgeType.NEWCOMER,
    category: AchievementCategory.MILESTONE,
    name: 'Newcomer',
    description: 'Joined and started earning XP',
  },
  [BadgeType.RISING_STAR]: {
    type: BadgeType.RISING_STAR,
    category: AchievementCategory.MILESTONE,
    name: 'Rising Star',
    description: 'Top weekly XP gainer',
  },
  [BadgeType.VETERAN]: {
    type: BadgeType.VETERAN,
    category: AchievementCategory.MILESTONE,
    name: 'Veteran',
    description: 'Active for over a year',
  },
} as const;
