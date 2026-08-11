import { EXAMPLE_TIMESTAMP } from './_timestamp';
import { LevelTitle } from '../../../domain/types/level.types';

/**
 * Phase 1 (S-2): live example for `GET /users/me/summary`. Mirrors
 * the shape of `UserSummaryResponseDto` (with sensible defaults for
 * every field) and the canonical envelope wrapper.
 */
export const USER_ME_SUMMARY_EXAMPLE = {
  data: {
    userId: '550e8400-e29b-71d4-a716-446655440000',
    username: 'alice_wonder',
    displayName: 'Alice',
    avatarUrl: 'https://example.com/avatars/alice.jpg',
    bio: 'Quiz enthusiast',
    country: 'Vietnam',
    countryCode: 'VN',
    bgImageUrl: 'https://example.com/bg/alice.jpg',
    createdAt: '2025-01-15T08:30:00.000Z',
    updatedAt: '2026-07-20T12:00:00.000Z',
    xpTotal: 15420,
    level: 31,
    currentLevelXP: 15000,
    nextLevelXP: 15500,
    xpProgressPercent: 84.0,
    levelTitle: LevelTitle.Specialist,
    levelTitleLocalised: 'Specialist',
    currentStreak: 7,
    longestStreak: 14,
    quizzesCreated: 12,
    quizzesPublished: 9,
    quizzesTaken: 84,
    followers: 450,
    following: 78,
    friends: 12,
  },
  meta: { timestamp: EXAMPLE_TIMESTAMP },
} as const;
