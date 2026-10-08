import { UserGraphqlResolver, USER_CONNECTION_LIMITS } from './user.graphql-resolver';
import type { GqlContext } from '@/core/graphql/graphql-context';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { LevelTitle } from '@/modules/user/domain/types/level.types';
import { UserProfilePrivateError } from '@/modules/user/domain/errors/user-profile-private.error';

const AUTHENTICATED: JwtPayload = { sub: 'user-1', role: 'user' };

const summary = {
  userId: 'user-1',
  username: 'alice',
  displayName: 'Alice',
  avatarUrl: null,
  bio: null,
  country: null,
  countryCode: null,
  bgImageUrl: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  xpTotal: 4200,
  level: 9,
  currentLevelXP: 4000,
  nextLevelXP: 4500,
  xpProgressPercent: 40,
  levelTitle: LevelTitle.Apprentice,
  levelTitleLocalised: 'Apprentice',
  currentStreak: 3,
  longestStreak: 9,
  quizzesCreated: 2,
  quizzesPublished: 1,
  quizzesTaken: 40,
  followers: 12,
  following: 5,
  friends: 2,
  coinBalance: 90,
};

const analytics = {
  userId: 'user-1',
  summary: { totalAttempts: 120, completedQuizzes: 80, averageScore: 88.5 },
  favoriteCategory: { categoryId: 'c1', name: 'Web' },
  favoriteTag: { tagId: 't1', name: 'JavaScript' },
  lastUpdated: '2026-02-01T00:00:00.000Z',
};

const xpHistory = {
  bucket: 'day' as const,
  unit: 'xp',
  points: [{ date: '2026-02-01T00:00:00.000Z', value: 250 }],
};

const recentActivity = [
  {
    eventId: 'e1',
    eventType: 'attempt_completed',
    createdAt: '2026-02-01T10:00:00.000Z',
    metadata: { quizId: 'q1', score: 90 },
  },
];

const wallet = {
  balance: 90,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-02-01T00:00:00.000Z',
  lastTransactionAt: '2026-02-01T00:00:00.000Z',
  earnedToday: 15,
  dailyEarnCap: 200,
};

const bundleFor = (overrides: Record<string, unknown> = {}) => ({
  summary,
  analytics,
  xpHistory,
  recentActivity,
  wallet,
  ...overrides,
});

const anonCtx: GqlContext = { loaders: null };
const authCtx: GqlContext = { user: AUTHENTICATED, loaders: null };

describe('UserGraphqlResolver', () => {
  const profileBundleService = {
    getBundleForCurrentUser: jest.fn(),
    getBundleForUser: jest.fn(),
  };
  const userApplicationService = { getUserByUsername: jest.fn() };
  const socialApplicationService = {
    getFollowersOfUser: jest.fn(),
    getFollowingOfUser: jest.fn(),
    getUserActivity: jest.fn(),
  };

  const createResolver = () =>
    new UserGraphqlResolver(
      profileBundleService as never,
      userApplicationService as never,
      socialApplicationService as never,
    );

  beforeEach(() => {
    jest.clearAllMocks();
    userApplicationService.getUserByUsername.mockResolvedValue({
      userId: 'user-1',
      username: 'alice',
      displayName: 'Alice',
      avatarUrl: null,
      isVerified: false,
    });
    profileBundleService.getBundleForCurrentUser.mockResolvedValue(bundleFor());
    profileBundleService.getBundleForUser.mockResolvedValue(bundleFor({ wallet: null }));
  });

  describe('userProfile', () => {
    it('resolves a public profile for an anonymous caller', async () => {
      const result = await createResolver().userProfile('alice', anonCtx);

      expect(result.summary).toMatchObject({ username: 'alice', level: 9 });
    });

    /**
     * A third party reading someone else's profile gets the summary only.
     * Withholding the private fields is what stops a signed-in user from
     * reading another account's analytics or coin balance.
     */
    it('withholds the auth-gated fields from a third party', async () => {
      const other: JwtPayload = { sub: 'user-2', role: 'user' };

      const result = await createResolver().userProfile('alice', { user: other, loaders: null });

      expect(result.analytics).toBeNull();
      expect(result.xpHistory).toBeNull();
      expect(result.recentActivity).toBeNull();
    });

    it('withholds every auth-gated field from an anonymous caller', async () => {
      const result = await createResolver().userProfile('alice', anonCtx);

      expect(result.analytics).toBeNull();
      expect(result.xpHistory).toBeNull();
      expect(result.recentActivity).toBeNull();
      expect(result.wallet).toBeNull();
    });

    it('populates every gated field when the viewer is the profile owner', async () => {
      const result = await createResolver().userProfile('alice', authCtx);

      expect(result.analytics).not.toBeNull();
      expect(result.xpHistory).not.toBeNull();
      expect(result.recentActivity).toHaveLength(1);
      expect(result.wallet).not.toBeNull();
    });

    it('uses the self bundle for the owner so the wallet is populated', async () => {
      await createResolver().userProfile('alice', authCtx);

      expect(profileBundleService.getBundleForCurrentUser).toHaveBeenCalledWith(
        'user-1',
        undefined,
      );
      expect(profileBundleService.getBundleForUser).not.toHaveBeenCalled();
    });

    it('uses the public bundle for everyone else', async () => {
      await createResolver().userProfile('alice', anonCtx);

      expect(profileBundleService.getBundleForUser).toHaveBeenCalledWith(
        'user-1',
        'user-1',
        undefined,
      );
      expect(profileBundleService.getBundleForCurrentUser).not.toHaveBeenCalled();
    });

    it('forwards the accept-language header for level title negotiation', async () => {
      const ctx: GqlContext = {
        user: AUTHENTICATED,
        loaders: null,
        req: { headers: { 'accept-language': 'vi' } },
      };

      await createResolver().userProfile('alice', ctx);

      expect(profileBundleService.getBundleForCurrentUser).toHaveBeenCalledWith('user-1', 'vi');
    });

    it('presents the category and tag favourites with an id field', async () => {
      const result = await createResolver().userProfile('alice', authCtx);

      expect(result.analytics?.favoriteCategory).toEqual({ id: 'c1', name: 'Web' });
      expect(result.analytics?.favoriteTag).toEqual({ id: 't1', name: 'JavaScript' });
    });

    /**
     * The metadata bag is open-ended, so only its keys are published. The
     * values are attacker-influenced and a GraphQL schema has to name types.
     */
    it('exposes metadata keys without their values', async () => {
      const result = await createResolver().userProfile('alice', authCtx);

      expect(result.recentActivity?.[0].metadataKeys).toEqual(['quizId', 'score']);
    });

    it('keeps absent metadata null rather than reporting an empty key set', async () => {
      profileBundleService.getBundleForCurrentUser.mockResolvedValue(
        bundleFor({ recentActivity: [{ ...recentActivity[0], metadata: null }] }),
      );

      const result = await createResolver().userProfile('alice', authCtx);

      expect(result.recentActivity?.[0].metadataKeys).toBeNull();
    });
  });

  describe('followers and following', () => {
    const page = {
      items: [
        { userId: 'u2', username: 'bob', avatarUrl: null, followedAt: '2026-01-01T00:00:00.000Z' },
      ],
      pagination: { kind: 'cursor' as const, limit: 50, hasNextPage: true, nextCursor: 'next' },
    };

    it('returns null for an anonymous caller without querying the service', async () => {
      const result = await createResolver().followers({ summary } as never, anonCtx);

      expect(result).toBeNull();
      expect(socialApplicationService.getFollowersOfUser).not.toHaveBeenCalled();
    });

    it('populates the connection for an authenticated caller', async () => {
      socialApplicationService.getFollowersOfUser.mockResolvedValue(page);

      const result = await createResolver().followers({ summary } as never, authCtx);

      expect(result?.items).toHaveLength(1);
      expect(result?.pageInfo).toEqual({ limit: 50, nextCursor: 'next', hasNextPage: true });
    });

    it('defaults the follower page size to the rail default', async () => {
      socialApplicationService.getFollowersOfUser.mockResolvedValue(page);

      await createResolver().followers({ summary } as never, authCtx);

      expect(socialApplicationService.getFollowersOfUser).toHaveBeenCalledWith(
        AUTHENTICATED,
        'user-1',
        null,
        USER_CONNECTION_LIMITS.DEFAULT_SOCIAL_LIMIT,
      );
    });

    it('clamps a caller asking for more than the maximum page', async () => {
      socialApplicationService.getFollowersOfUser.mockResolvedValue(page);

      await createResolver().followers({ summary } as never, authCtx, 5000);

      expect(socialApplicationService.getFollowersOfUser).toHaveBeenCalledWith(
        AUTHENTICATED,
        'user-1',
        null,
        USER_CONNECTION_LIMITS.MAX_SOCIAL_LIMIT,
      );
    });

    it('passes the cursor through for the next page', async () => {
      socialApplicationService.getFollowingOfUser.mockResolvedValue(page);

      await createResolver().following({ summary } as never, authCtx, 10, 'cursor-1');

      expect(socialApplicationService.getFollowingOfUser).toHaveBeenCalledWith(
        AUTHENTICATED,
        'user-1',
        'cursor-1',
        10,
      );
    });
  });

  describe('activity', () => {
    const page = {
      items: [
        {
          id: 'a1',
          type: 'attempt_completed',
          occurredAt: '2026-01-01T00:00:00.000Z',
          payload: { quizId: 'q1' },
          actor: {
            userId: 'user-1',
            username: 'alice',
            displayName: 'Alice',
            avatarUrl: null,
          },
        },
      ],
      pagination: { kind: 'cursor' as const, limit: 30, hasNextPage: false, nextCursor: null },
    };

    it('returns null for an anonymous caller', async () => {
      const result = await createResolver().activity({ summary } as never, anonCtx);

      expect(result).toBeNull();
    });

    it('populates the timeline for an authenticated caller', async () => {
      socialApplicationService.getUserActivity.mockResolvedValue(page);

      const result = await createResolver().activity({ summary } as never, authCtx);

      expect(result?.items[0]).toMatchObject({ id: 'a1', type: 'attempt_completed' });
    });

    it('drops the open-ended payload, which the schema cannot name', async () => {
      socialApplicationService.getUserActivity.mockResolvedValue(page);

      const result = await createResolver().activity({ summary } as never, authCtx);

      expect(result?.items[0]).not.toHaveProperty('payload');
    });

    /**
     * A private timeline is a normal state, not a failure, so it degrades to
     * null and the surrounding query still resolves.
     */
    it('degrades a private timeline to null', async () => {
      socialApplicationService.getUserActivity.mockRejectedValue(
        new UserProfilePrivateError('user-1'),
      );

      const result = await createResolver().activity({ summary } as never, authCtx);

      expect(result).toBeNull();
    });

    it('propagates a fault that is not a privacy restriction', async () => {
      socialApplicationService.getUserActivity.mockRejectedValue(
        new Error('connect ECONNREFUSED db:5432'),
      );

      await expect(createResolver().activity({ summary } as never, authCtx)).rejects.toThrow(
        'ECONNREFUSED',
      );
    });
  });
});
