/**
 * Social Service — domain contract tests.
 *
 * Pins the social-module invariants the rest of the application
 * depends on:
 *  - `blockUser` and `unblockUser` wrap their DB writes + audit-log
 *    entry in a single `db.transaction()` so the audit row is
 *    atomic with the underlying mutation.
 *  - `blockUser` always removes the friendship in the same
 *    transaction.
 *  - `unfollowUser` and `removeFriend` raise `SocialConsistencyError`
 *    (409) when the post-write row count is zero despite the
 *    pre-write `find*` check returning a row — that is the contract
 *    callers depend on to distinguish a tight concurrent-modify
 *    race from a missing-resource 404.
 *  - `searchUsers` excludes users blocked by either direction and
 *    drops the internal `avatarPublicId` from the wire shape.
 */

import type { DrizzleDB } from '@/core/database/database.module';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { SocialService } from '@/modules/social/domain/services/social.service';
import type { CacheProvider } from '@/common/ports/cache.provider';
import type {
  SocialRepositoryPort,
  SocialDomainEventBusPort,
  RankingPort,
  UserSearchPort,
  UserRepositoryPort,
  UserDomainService,
} from '@/modules/social/domain/ports';
import type {
  FriendshipRepositoryPort,
  FriendshipExecutor,
} from '@/modules/social/domain/ports/friendship-ports';
import type { UserFollowRepositoryPort } from '@/modules/social/domain/ports/user-follow-ports';
import type { BlockRepositoryPort, BlockExecutor } from '@/modules/social/domain/ports/block-ports';
import type { AuditExecutor, AuditLogService } from '@/common/audit/audit-log.service';
import type { SocialCacheService } from '@/modules/social/infrastructure/cache/social-cache.service';
import type { SocialFeedCache } from '@/modules/social/infrastructure/cache/social-feed-cache.service';
import type { StoragePort } from '@/core/storage/storage.port';
import { SocialConsistencyError, UserNotBlockedError } from '@/modules/social/domain/errors';

const logger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
} as const;

const user: JwtPayload = {
  sub: 'user-1',
  role: 'user',
  email: 'a@b.c',
  username: 'u',
} as JwtPayload;

interface TxMock extends AuditExecutor, FriendshipExecutor, BlockExecutor {
  insert: jest.Mock;
  execute: jest.Mock;
}

function makeTxMock(): TxMock {
  return {
    insert: jest.fn().mockResolvedValue(undefined),
    execute: jest.fn().mockResolvedValue({ rows: [] }),
  };
}

function makeFriendshipRepo(): jest.Mocked<FriendshipRepositoryPort> {
  return {
    createFriendRequest: jest.fn(),
    createFriendRequestWithJoin: jest.fn(),
    getFriendRequest: jest.fn(),
    getPendingRequests: jest.fn(),
    getSentRequests: jest.fn(),
    respondToFriendRequest: jest.fn(),
    cancelFriendRequestById: jest.fn(),
    getFriends: jest.fn(),
    getFriendCount: jest.fn(),
    removeFriend: jest.fn(),
    removeFriendInTx: jest.fn(),
    findAcceptedFriendship: jest.fn(),
    getMostRecentPendingFriendshipId: jest.fn(),
    getMutualFriends: jest.fn(),
  } as unknown as jest.Mocked<FriendshipRepositoryPort>;
}

function makeFollowRepo(): jest.Mocked<UserFollowRepositoryPort> {
  return {
    followUser: jest.fn(),
    unfollowUser: jest.fn(),
    findActiveFollow: jest.fn(),
    getFollowers: jest.fn(),
    getFollowersOfUser: jest.fn(),
    getFollowing: jest.fn(),
    getFollowingOfUser: jest.fn(),
    getMutualFollowers: jest.fn(),
    getFollowerCount: jest.fn(),
    getFollowingCount: jest.fn(),
    isFollowing: jest.fn(),
    getUsernamesForUsers: jest.fn(),
  };
}

function makeBlockRepo(): jest.Mocked<BlockRepositoryPort> {
  return {
    blockUser: jest.fn(),
    blockUserInTx: jest.fn(),
    unblockUser: jest.fn(),
    unblockUserInTx: jest.fn(),
    findActiveBlock: jest.fn(),
    isBlocked: jest.fn(),
    getBlockedUsers: jest.fn(),
  };
}

function makeSocialRepo(): jest.Mocked<SocialRepositoryPort> {
  return {
    createFeedActivity: jest.fn(),
    getFeed: jest.fn(),
    findActivitiesByUserId: jest.fn(),
    getSocialCounts: jest.fn(),
    getUserSocialStats: jest.fn(),
    getSocialAnalytics: jest.fn(),
    getSuggestions: jest.fn(),
    getTrendingUsers: jest.fn(),
    getRelationshipStatus: jest.fn(),
    getRelationshipStatusesBatch: jest.fn(),
    respondToFriendRequest: jest.fn(),
    blockUser: jest.fn(),
    unblockUser: jest.fn(),
    findActiveBlock: jest.fn(),
    isBlocked: jest.fn(),
    getBlockedUsers: jest.fn(),
  } as unknown as jest.Mocked<SocialRepositoryPort>;
}

function makeBus(): jest.Mocked<SocialDomainEventBusPort> {
  return {
    emitFriendRequestSent: jest.fn(),
    emitFriendRequestAccepted: jest.fn(),
    emitFriendRequestRejected: jest.fn(),
    emitFriendRequestCancelled: jest.fn(),
    emitFriendRemoved: jest.fn(),
    emitUserBlocked: jest.fn(),
    emitUserUnblocked: jest.fn(),
    emitUserFollowed: jest.fn(),
    emitUserUnfollowed: jest.fn(),
    subscribe: jest.fn(() => () => undefined),
  } as unknown as jest.Mocked<SocialDomainEventBusPort>;
}

function makeAuditLogService(): jest.Mocked<AuditLogService> {
  return {
    record: jest.fn(),
    recordWithExecutor: jest.fn(),
    purgeExpired: jest.fn(),
  } as unknown as jest.Mocked<AuditLogService>;
}

function makeCache(): jest.Mocked<SocialCacheService> {
  return {
    invalidateCountsBatch: jest.fn(),
    getSocialCounts: jest.fn(),
  } as unknown as jest.Mocked<SocialCacheService>;
}

function makeSocialFeedCache(): jest.Mocked<SocialFeedCache> {
  return {
    getOrSetFeed: jest.fn(async (_userId, _versionHash, fetcher) => fetcher()),
    invalidateFeed: jest.fn(),
    invalidateAll: jest.fn(),
  } as unknown as jest.Mocked<SocialFeedCache>;
}

function makeStorage(): jest.Mocked<StoragePort> {
  return {
    deriveUrl: jest.fn((id: string) => `https://cdn.example.com/${id}`),
    signUpload: jest.fn(),
    remove: jest.fn(),
  } as unknown as jest.Mocked<StoragePort>;
}

function makeRanking(): jest.Mocked<RankingPort> {
  return {
    getRankingsForUsers: jest.fn(),
    getTotalParticipants: jest.fn(),
    getUserRank: jest.fn(),
    getRankTrendsForUsers: jest.fn(),
  };
}

function makeUserSearch(): jest.Mocked<UserSearchPort> {
  return {
    searchUsers: jest.fn(),
    searchUsernameSuggestions: jest.fn(),
  };
}

function makeUserRepo(): jest.Mocked<UserRepositoryPort> {
  return {} as unknown as jest.Mocked<UserRepositoryPort>;
}

function makeUserDomainService(): jest.Mocked<UserDomainService> {
  return {} as unknown as jest.Mocked<UserDomainService>;
}

function makeCacheProvider(): jest.Mocked<CacheProvider> {
  const counterStore = new Map<string, number>();
  return {
    incrementWindowCounter: jest.fn(async (key: string) => {
      const next = (counterStore.get(key) ?? 0) + 1;
      counterStore.set(key, next);
      return next;
    }),
    setIfNotExistsWithTtlSeconds: jest.fn().mockResolvedValue(true),
    incrementCounterWithInitialTtlSeconds: jest.fn(async (key: string) => {
      const next = (counterStore.get(key) ?? 0) + 1;
      counterStore.set(key, next);
      return next;
    }),
    get: jest.fn(async (_key: string) => null),
    set: jest.fn(),
    del: jest.fn().mockResolvedValue(false),
    getDel: jest.fn().mockResolvedValue(null),
    unlinkByPattern: jest.fn().mockResolvedValue(0),
    getOrSet: jest.fn(),
    getOrSetWithStampedeProtection: jest.fn(),
    rpushJson: jest.fn().mockResolvedValue(0),
    lpopJson: jest.fn().mockResolvedValue(null),
    lrangeJson: jest.fn().mockResolvedValue([]),
    trimList: jest.fn().mockResolvedValue(0),
    expire: jest.fn().mockResolvedValue(true),
    zaddByScore: jest.fn().mockResolvedValue(1),
    zrangeByScore: jest.fn().mockResolvedValue([]),
    zrem: jest.fn().mockResolvedValue(false),
    acquireAdvisoryLock: jest.fn().mockResolvedValue(null),
    releaseAdvisoryLock: jest.fn().mockResolvedValue(false),
  } as unknown as jest.Mocked<CacheProvider>;
}

function makeDb(): jest.Mocked<DrizzleDB> {
  const txMock = makeTxMock();
  return {
    transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(txMock)),
  } as unknown as jest.Mocked<DrizzleDB>;
}

function makeService(
  overrides: {
    cacheProvider?: jest.Mocked<CacheProvider>;
    logger?: Record<'debug' | 'info' | 'warn' | 'error' | 'fatal' | 'trace', jest.Mock>;
    socialRepo?: jest.Mocked<SocialRepositoryPort>;
  } = {},
) {
  const db = makeDb();
  const friendshipRepo = makeFriendshipRepo();
  const followRepo = makeFollowRepo();
  const blockRepo = makeBlockRepo();
  const socialRepo = overrides.socialRepo ?? makeSocialRepo();
  const eventBus = makeBus();
  const auditLogService = makeAuditLogService();
  const cache = makeCache();
  const socialFeedCache = makeSocialFeedCache();
  const storage = makeStorage();
  const ranking = makeRanking();
  const userSearch = makeUserSearch();
  const userRepository = makeUserRepo();
  const userDomainService = makeUserDomainService();
  const cacheProvider = overrides.cacheProvider ?? makeCacheProvider();
  const injectedLogger = overrides.logger ?? logger;

  const service = new SocialService(
    db,
    friendshipRepo,
    followRepo,
    blockRepo,
    socialRepo,
    eventBus,
    userSearch,
    ranking,
    userRepository,
    userDomainService,
    storage,
    auditLogService,
    cache,
    socialFeedCache,
    cacheProvider,
    injectedLogger as never,
  );

  return {
    service,
    db,
    friendshipRepo,
    followRepo,
    blockRepo,
    socialRepo,
    eventBus,
    auditLogService,
    cache,
    socialFeedCache,
    storage,
    ranking,
    userSearch,
    cacheProvider,
    logger: injectedLogger,
  };
}

describe('SocialService.blockUser', () => {
  it('wraps the block write, friendship removal, and audit row in one transaction', async () => {
    const { service, db, blockRepo, friendshipRepo, auditLogService, cache, eventBus } =
      makeService();

    blockRepo.blockUserInTx.mockResolvedValue({
      blockId: 'block-1',
      blockerId: 'user-1',
      blockedId: 'user-2',
      reason: 'spam',
      createdAt: '2026-01-01T00:00:00.000Z',
      deletedAt: null,
    } as never);
    friendshipRepo.removeFriendInTx.mockResolvedValue(1);

    await service.blockUser('user-1', 'user-2', 'spam');

    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(blockRepo.blockUserInTx).toHaveBeenCalledTimes(1);
    expect(friendshipRepo.removeFriendInTx).toHaveBeenCalledTimes(1);
    expect(auditLogService.recordWithExecutor).toHaveBeenCalledTimes(1);
    expect(auditLogService.recordWithExecutor.mock.calls[0][1]).toMatchObject({
      eventType: 'social.user.blocked',
      domain: 'social',
      action: 'user.blocked',
      actorId: 'user-1',
      subjectUserId: 'user-2',
    });
    expect(cache.invalidateCountsBatch).toHaveBeenCalledWith(['user-1', 'user-2']);
    expect(eventBus.emitUserBlocked).toHaveBeenCalledTimes(1);
    expect(auditLogService.record).not.toHaveBeenCalled();
  });
});

describe('SocialService.unblockUser', () => {
  it('wraps the unblock update + audit row in one transaction', async () => {
    const { service, db, blockRepo, auditLogService, cache, eventBus } = makeService();
    blockRepo.findActiveBlock.mockResolvedValue({
      blockId: 'block-1',
      blockerId: 'user-1',
      blockedId: 'user-2',
      reason: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      deletedAt: null,
    } as never);
    blockRepo.unblockUserInTx.mockResolvedValue(1);

    await service.unblockUser('user-1', 'user-2');

    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(blockRepo.unblockUserInTx).toHaveBeenCalledTimes(1);
    expect(auditLogService.recordWithExecutor).toHaveBeenCalledTimes(1);
    expect(auditLogService.recordWithExecutor.mock.calls[0][1]).toMatchObject({
      eventType: 'social.user.unblocked',
      domain: 'social',
      action: 'user.unblocked',
      actorId: 'user-1',
      subjectUserId: 'user-2',
    });
    expect(cache.invalidateCountsBatch).toHaveBeenCalledWith(['user-1', 'user-2']);
    expect(eventBus.emitUserUnblocked).toHaveBeenCalledTimes(1);
  });

  it('throws UserNotBlockedError when findActiveBlock returns null', async () => {
    const { service, blockRepo } = makeService();
    blockRepo.findActiveBlock.mockResolvedValue(null);

    await expect(service.unblockUser('user-1', 'user-2')).rejects.toBeInstanceOf(
      UserNotBlockedError,
    );
  });

  it('emits nothing and skips audit when unblockUserInTx returns 0', async () => {
    const { service, blockRepo, auditLogService, cache, eventBus } = makeService();
    blockRepo.findActiveBlock.mockResolvedValue({
      blockId: 'block-1',
      blockerId: 'user-1',
      blockedId: 'user-2',
      reason: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      deletedAt: null,
    } as never);
    blockRepo.unblockUserInTx.mockResolvedValue(0);

    await service.unblockUser('user-1', 'user-2');

    expect(auditLogService.recordWithExecutor).not.toHaveBeenCalled();
    expect(cache.invalidateCountsBatch).not.toHaveBeenCalled();
    expect(eventBus.emitUserUnblocked).not.toHaveBeenCalled();
  });
});

describe('SocialService.unfollowUser', () => {
  it('throws SocialConsistencyError when findActiveFollow finds a row but unfollowUser returns 0', async () => {
    const { service, followRepo } = makeService();
    followRepo.findActiveFollow.mockResolvedValue({
      followId: 'follow-1',
      followerId: 'user-1',
      followingId: 'user-2',
      followerUsername: 'u',
      followingUsername: 't',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    followRepo.unfollowUser.mockResolvedValue(0);

    await expect(service.unfollowUser('user-1', 'user-2')).rejects.toBeInstanceOf(
      SocialConsistencyError,
    );
  });
});

describe('SocialService.removeFriend', () => {
  it('throws SocialConsistencyError when findAcceptedFriendship finds a row but removeFriend returns 0', async () => {
    const { service, friendshipRepo } = makeService();
    friendshipRepo.findAcceptedFriendship.mockResolvedValue({
      friendshipId: 'f-1',
      requesterId: 'user-1',
      addresseeId: 'user-2',
      status: 'accepted',
      deletedAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    } as never);
    friendshipRepo.removeFriend.mockResolvedValue(0);

    await expect(service.removeFriend('user-1', 'user-2')).rejects.toBeInstanceOf(
      SocialConsistencyError,
    );
  });
});

describe('SocialService.searchUsers', () => {
  it('filters out users blocked in either direction', async () => {
    const { service, socialRepo, userSearch, storage } = makeService();
    userSearch.searchUsers.mockResolvedValue([
      {
        userId: 'user-2',
        username: 'two',
        displayName: null,
        avatarUrl: null,
        avatarPublicId: 'public-2',
      },
      {
        userId: 'user-3',
        username: 'three',
        displayName: null,
        avatarUrl: null,
        avatarPublicId: null,
      },
    ]);
    socialRepo.getRelationshipStatusesBatch.mockResolvedValue(
      new Map([
        [
          'user-2',
          {
            isFriend: false,
            hasPendingRequest: false,
            isFollower: false,
            isFollowing: false,
            isBlocked: false,
            isBlockedBy: true,
          },
        ],
        [
          'user-3',
          {
            isFriend: false,
            hasPendingRequest: false,
            isFollower: false,
            isFollowing: false,
            isBlocked: false,
            isBlockedBy: false,
          },
        ],
      ]),
    );

    const result = await service.searchUsers(user.sub, 'two', 20);

    expect(result).toHaveLength(1);
    expect(result[0].userId).toBe('user-3');
    expect(result[0]).not.toHaveProperty('avatarPublicId');
    expect(storage.deriveUrl).not.toHaveBeenCalled();
  });
});

describe('SocialService.recordFeedActivity (fleet-wide throttle)', () => {
  const recordParams = {
    userId: 'user-1',
    activityType: 'quiz_completed' as const,
    occurredAt: new Date().toISOString(),
    payload: {},
  };

  it('increments a Redis counter keyed by userId + activityType', async () => {
    const { service, socialRepo, cacheProvider } = makeService();
    cacheProvider.incrementCounterWithInitialTtlSeconds.mockResolvedValue(1);

    await service.recordFeedActivity(recordParams);

    expect(cacheProvider.incrementCounterWithInitialTtlSeconds).toHaveBeenCalledTimes(1);
    const key = (
      cacheProvider.incrementCounterWithInitialTtlSeconds.mock.calls[0] as unknown as string[]
    )[0];
    expect(key).toBe('social:feed_activity:user-1:quiz_completed');
    const ttl = (
      cacheProvider.incrementCounterWithInitialTtlSeconds.mock.calls[0] as unknown as number[]
    )[1];
    expect(ttl).toBe(60);
    expect(socialRepo.createFeedActivity).toHaveBeenCalledTimes(1);
  });

  it('does not write a feed activity when the counter exceeds the per-window limit', async () => {
    const { service, socialRepo, cacheProvider, logger } = makeService();
    cacheProvider.incrementCounterWithInitialTtlSeconds.mockResolvedValue(31);

    await service.recordFeedActivity(recordParams);

    expect(socialRepo.createFeedActivity).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
  });

  it('counts activities from two simulated instances against the same Redis bucket', async () => {
    const sharedCounters = new Map<string, number>();
    let writesAcrossBothInstances = 0;
    const sharedCache: jest.Mocked<CacheProvider> = {
      ...makeCacheProvider(),
      incrementCounterWithInitialTtlSeconds: jest.fn(async (key: string) => {
        const next = (sharedCounters.get(key) ?? 0) + 1;
        sharedCounters.set(key, next);
        return next;
      }),
    } as unknown as jest.Mocked<CacheProvider>;
    const sharedSocialRepo: jest.Mocked<SocialRepositoryPort> = {
      ...makeSocialRepo(),
      createFeedActivity: jest.fn(async () => {
        writesAcrossBothInstances += 1;
      }),
    } as unknown as jest.Mocked<SocialRepositoryPort>;

    const instanceA = makeService({
      cacheProvider: sharedCache,
      socialRepo: sharedSocialRepo,
    }).service;
    const instanceB = makeService({
      cacheProvider: sharedCache,
      socialRepo: sharedSocialRepo,
    }).service;

    for (let i = 0; i < 60; i++) {
      const caller = i % 2 === 0 ? instanceA : instanceB;
      await caller.recordFeedActivity(recordParams);
    }

    const counterKey = 'social:feed_activity:user-1:quiz_completed';
    expect(sharedCounters.get(counterKey)).toBe(60);
    expect(writesAcrossBothInstances).toBe(30);
  });

  it('falls back to writing the activity when Redis throws on the throttle check', async () => {
    const { service, socialRepo, cacheProvider } = makeService();
    cacheProvider.incrementCounterWithInitialTtlSeconds.mockRejectedValue(
      new Error('circuit open'),
    );

    await service.recordFeedActivity(recordParams);

    expect(socialRepo.createFeedActivity).toHaveBeenCalledTimes(1);
  });
});
