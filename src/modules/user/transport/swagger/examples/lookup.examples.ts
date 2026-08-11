import { EXAMPLE_TIMESTAMP } from './_timestamp';

/**
 * Phase 1 (S-1): live example for `GET /users/by-username/:username`.
 * The wire shape is `UserLookupResponseDto` — five-field public
 * identity projection of a user keyed by handle.
 */
export const USER_LOOKUP_EXAMPLE = {
  data: {
    userId: '550e8400-e29b-71d4-a716-446655440000',
    username: 'alice_wonder',
    displayName: 'Alice',
    avatarUrl: 'https://example.com/avatars/alice.jpg',
    isVerified: true,
  },
  meta: { timestamp: EXAMPLE_TIMESTAMP },
} as const;
