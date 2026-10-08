import { Inject, Injectable, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';

import { UserAnalyticsResponseDto } from '../dto/response/user-analytics.dto';
import { TimeSeriesDto } from '../dto/response/time-series.dto';
import { UserActivityItemDto } from '../dto/response/user-activity.dto';
import { UserProfileBundleResponseDto } from '../dto/response/user-profile-bundle.dto';

import { UserSummaryService } from './user-summary.service';
import {
  COIN_REPOSITORY_PORT,
  type CoinRepositoryPort,
} from '@/modules/coins/domain/ports/coin-repository.port';
import { COIN_ECONOMY_LIMITS } from '@/modules/coins/coin.constants';
import { CACHE_PROVIDER, type CacheProvider } from '@/common/ports/cache.provider';
import { stampedeProtectedGetOrSet } from '@/modules/quiz/application/quiz-cache.utils';
import { MetricsRegistry } from '@/core/observability/metrics.registry';
import {
  USER_DOMAIN_EVENT_BUS,
  type UserDomainEventBusPort,
} from '../domain/events/user-domain-event-bus.port';

@Injectable()
export class UserProfileBundleService implements OnModuleInit, OnModuleDestroy {
  private static readonly RECENT_ACTIVITY_LIMIT = 10;
  private static readonly CACHE_TTL_MS = 5 * 60_000;
  static readonly CACHE_NAMESPACE = 'user:profile-bundle:v1';
  private readonly cacheName = 'user-profile-bundle';

  private unsubscribe: (() => void) | null = null;

  constructor(
    private readonly userSummaryService: UserSummaryService,
    @Inject(COIN_REPOSITORY_PORT)
    private readonly coinRepository: CoinRepositoryPort,
    @Inject(CACHE_PROVIDER)
    private readonly cache: CacheProvider,
    @Optional()
    @Inject(USER_DOMAIN_EVENT_BUS)
    private readonly userEventBus?: UserDomainEventBusPort,
    @Optional()
    @Inject(MetricsRegistry)
    private readonly metrics?: MetricsRegistry,
  ) {}

  onModuleInit(): void {
    if (!this.userEventBus) return;
    this.unsubscribe = this.userEventBus.subscribe((event) => {
      const candidate = event as { userId?: unknown };
      if (!candidate || typeof candidate.userId !== 'string') return;
      void this.invalidateForUser(candidate.userId);
    });
  }

  onModuleDestroy(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  private profileBundleKey(userId: string, localeHash: string): string {
    return `${UserProfileBundleService.CACHE_NAMESPACE}:${userId}:${localeHash}`;
  }

  async invalidateForUser(userId: string): Promise<void> {
    if (!userId) return;
    try {
      await this.cache.unlinkByPattern(`${UserProfileBundleService.CACHE_NAMESPACE}:${userId}:*`);
    } catch {
      // Best-effort invalidation. The TTL bounds staleness at 2 minutes
      // even when Redis is unreachable.
    }
  }

  async getBundleForCurrentUser(
    userId: string,
    acceptLanguage?: string,
  ): Promise<UserProfileBundleResponseDto> {
    const localeHash = this.hashLocale(acceptLanguage);
    const cacheKey = this.profileBundleKey(userId, localeHash);

    return stampedeProtectedGetOrSet(
      this.cache,
      cacheKey,
      UserProfileBundleService.CACHE_TTL_MS,
      () => this.computeBundleForCurrentUser(userId, acceptLanguage),
    );
  }

  private async computeBundleForCurrentUser(
    userId: string,
    acceptLanguage?: string,
  ): Promise<UserProfileBundleResponseDto> {
    const todayMidnight = new Date();
    todayMidnight.setUTCHours(0, 0, 0, 0);

    const [summary, analytics, recentActivity, wallet, earnedToday] = await Promise.all([
      this.userSummaryService.getSummary(userId, userId, acceptLanguage),
      this.userSummaryService.getAnalytics(userId, userId),
      this.userSummaryService.getRecentActivity(
        userId,
        userId,
        UserProfileBundleService.RECENT_ACTIVITY_LIMIT,
      ),
      this.coinRepository.getWallet(userId),
      this.coinRepository.getDailyEarnCapSum(userId, todayMidnight),
    ]);

    const xpHistory: TimeSeriesDto = {
      bucket: 'day',
      unit: 'xp',
      points: [],
    };

    return {
      summary,
      analytics,
      xpHistory,
      recentActivity,
      wallet: this.toWalletDto(wallet, earnedToday),
    };
  }

  private hashLocale(locale: string | undefined): string {
    if (!locale) return 'default';
    let hash = 0x811c9dc5;
    for (let i = 0; i < locale.length; i += 1) {
      hash ^= locale.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }

  async getBundleForUser(
    targetUserId: string,
    requesterId: string,
    acceptLanguage?: string,
  ): Promise<UserProfileBundleResponseDto> {
    const summary = await this.userSummaryService.getSummary(
      targetUserId,
      requesterId,
      acceptLanguage,
    );

    const showStats = true;
    const showActivity = true;

    const analytics: UserAnalyticsResponseDto = showStats
      ? await this.userSummaryService.getAnalytics(targetUserId, requesterId)
      : {
          userId: targetUserId,
          summary: {
            totalAttempts: 0,
            completedQuizzes: 0,
            averageScore: 0,
          },
          favoriteCategory: null,
          favoriteTag: null,
          lastUpdated: new Date().toISOString(),
        };

    const recentActivity: UserActivityItemDto[] = showActivity
      ? await this.userSummaryService.getRecentActivity(
          targetUserId,
          requesterId,
          UserProfileBundleService.RECENT_ACTIVITY_LIMIT,
        )
      : [];

    const xpHistory: TimeSeriesDto = {
      bucket: 'day',
      unit: 'xp',
      points: [],
    };

    return {
      summary,
      analytics,
      xpHistory,
      recentActivity,
      wallet: null,
    };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────

  private toWalletDto(
    wallet: { balance: number; createdAt: string; updatedAt: string } | null,
    earnedToday: number = 0,
  ) {
    if (!wallet) {
      return {
        balance: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastTransactionAt: null,
        earnedToday,
        dailyEarnCap: COIN_ECONOMY_LIMITS.DAILY_QUIZ_EARNINGS_CAP,
      };
    }
    return {
      balance: wallet.balance,
      createdAt: wallet.createdAt,
      updatedAt: wallet.updatedAt,
      lastTransactionAt: wallet.updatedAt,
      earnedToday,
      dailyEarnCap: COIN_ECONOMY_LIMITS.DAILY_QUIZ_EARNINGS_CAP,
    };
  }
}
