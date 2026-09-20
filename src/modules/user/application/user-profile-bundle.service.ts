import { Inject, Injectable } from '@nestjs/common';

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
@Injectable()
export class UserProfileBundleService {
  private static readonly BUNDLE_TX_LIMIT = 20;
  private static readonly CACHE_TTL_MS = 2 * 60_000;
  private static readonly CACHE_NAMESPACE = 'user:profile-bundle:v1';

  constructor(
    private readonly userSummaryService: UserSummaryService,
    @Inject(COIN_REPOSITORY_PORT)
    private readonly coinRepository: CoinRepositoryPort,
    @Inject(CACHE_PROVIDER)
    private readonly cache: CacheProvider,
  ) {}

  async getBundleForCurrentUser(
    userId: string,
    acceptLanguage?: string,
  ): Promise<UserProfileBundleResponseDto> {
    const localeHash = this.hashLocale(acceptLanguage);
    const cacheKey = `${UserProfileBundleService.CACHE_NAMESPACE}:${userId}:${localeHash}`;

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

    const [summary, analytics, recentActivity, wallet, transactions, earnedToday] =
      await Promise.all([
        this.userSummaryService.getSummary(userId, userId, acceptLanguage),
        this.userSummaryService.getAnalytics(userId, userId),
        this.userSummaryService.getRecentActivity(userId, userId, 20),
        this.coinRepository.getWallet(userId),
        this.coinRepository.listTransactions({
          userId,
          cursorCreatedAt: null,
          cursorTransactionId: null,
          limit: UserProfileBundleService.BUNDLE_TX_LIMIT + 1, // +1 to detect next page
        }),
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
      transactions: this.toTransactionsPage(transactions),
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
      ? await this.userSummaryService.getRecentActivity(targetUserId, requesterId, 20)
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
      transactions: null,
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

  private toTransactionsPage(
    rows: Array<{
      transactionId: string;
      amount: number;
      balanceAfter: number;
      reason: string;
      referenceType: string | null;
      referenceId: string | null;
      metadata: Record<string, unknown>;
      createdAt: string;
    }>,
  ) {
    const hasNextPage = rows.length > UserProfileBundleService.BUNDLE_TX_LIMIT;
    const pageRows = hasNextPage ? rows.slice(0, UserProfileBundleService.BUNDLE_TX_LIMIT) : rows;

    return {
      items: pageRows.map((row) => ({
        transactionId: row.transactionId,
        amount: row.amount,
        balanceAfter: row.balanceAfter,
        reason: row.reason,
        referenceType: row.referenceType,
        referenceId: row.referenceId,
        metadata: row.metadata,
        createdAt: row.createdAt,
      })),
      pagination: {
        kind: 'cursor' as const,
        limit: UserProfileBundleService.BUNDLE_TX_LIMIT,
        hasNextPage,
        nextCursor: null,
      },
    };
  }
}
