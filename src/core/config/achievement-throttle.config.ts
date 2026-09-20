export const ACHIEVEMENT_THROTTLE_VALUES = {
  listBadgeCatalog: { limit: 60, ttl: 60_000 },
  getMyBadges: { limit: 120, ttl: 60_000 },
  getBadgeDetails: { limit: 240, ttl: 60_000 },
  revokeUserBadge: { limit: 20, ttl: 60_000 },
  getPublicAchievementProfile: { limit: 120, ttl: 60_000 },
  getMyBadgeProgress: { limit: 240, ttl: 60_000 },
  getMyAchievementHistory: { limit: 60, ttl: 60_000 },
  getMyBadgeAnalytics: { limit: 60, ttl: 60_000 },
  reevaluateUser: { limit: 5, ttl: 60_000 },
  getUserHistory: { limit: 60, ttl: 60_000 },
} as const;

export type AchievementThrottleConfig = typeof ACHIEVEMENT_THROTTLE_VALUES;
