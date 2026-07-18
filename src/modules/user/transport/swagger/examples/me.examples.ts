import { EXAMPLE_TIMESTAMP } from './_timestamp';

export const USER_ME_EXAMPLE = {
  data: {
    userId: '550e8400-e29b-71d4-a716-446655440000',
    username: 'alice_wonder',
    email: 'alice@example.com',
    displayName: 'Alice',
    avatarUrl: 'https://example.com/avatars/alice.jpg',
    bio: 'Quiz enthusiast',
    xpTotal: 15420,
    currentStreak: 7,
    longestStreak: 14,
    settings: { theme: 'dark', notifications: true },
    createdAt: '2025-01-15T08:30:00.000Z',
    updatedAt: '2025-06-01T12:00:00.000Z',
  },
  meta: { timestamp: EXAMPLE_TIMESTAMP },
} as const;

export const USER_ME_UPDATED_EXAMPLE = {
  data: {
    userId: '550e8400-e29b-71d4-a716-446655440000',
    username: 'alice_wonder',
    email: 'alice@example.com',
    displayName: 'Alice',
    avatarUrl: 'https://example.com/avatars/alice.jpg',
    bio: 'Quiz enthusiast and trivia lover',
    xpTotal: 15420,
    currentStreak: 7,
    longestStreak: 14,
    settings: { theme: 'dark', notifications: true },
    createdAt: '2025-01-15T08:30:00.000Z',
    updatedAt: '2026-06-25T10:30:00.000Z',
  },
  meta: { timestamp: EXAMPLE_TIMESTAMP },
} as const;

export const USER_ME_SETTINGS_UPDATED_EXAMPLE = {
  data: {
    userId: '550e8400-e29b-71d4-a716-446655440000',
    username: 'alice_wonder',
    email: 'alice@example.com',
    displayName: 'Alice',
    avatarUrl: 'https://example.com/avatars/alice.jpg',
    bio: 'Quiz enthusiast',
    xpTotal: 15420,
    currentStreak: 7,
    longestStreak: 14,
    settings: { theme: 'light', notifications: false, language: 'vi' },
    createdAt: '2025-01-15T08:30:00.000Z',
    updatedAt: '2026-06-25T10:30:00.000Z',
  },
  meta: { timestamp: EXAMPLE_TIMESTAMP },
} as const;
