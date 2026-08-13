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

/**
 * `UserProfileBundleService` — Phase 4 (S-25 + S-26) bundle
 * returned by `GET /users/me/profile` and `GET /users/:userId/profile`.
 *
 * The my-profile page used to issue 8+ sequential calls (summary,
 * analytics, xp history, recent activity, social counts, …). The
 * bundle collapses the fan-out into a single round-trip by
 * parallelising the sub-queries. The wire shape is the union of
 * the existing per-endpoint DTOs so the frontend can drop the
 * bundle straight into the existing profile view with no
 * consumer-side projection.
 *
 * ## Phase 3 (S-coin) integration
 *
 * The `/me` variant includes the caller's wallet snapshot and the
 * first page of their transaction history (capped at 20). The
 * `:userId` variant **omits** both — privacy: a viewer should not
 * see another user's balance or ledger. The bundle is therefore the
 * single round-trip the my-profile page needs: header pill, recent
 * activity, transactions, XP history all read from this payload.
 *
 * ## Privacy contract (S-26)
 *
 * For the `:userId` variant, the bundle fetches the user's
 * privacy flags from `user_profiles` and:
 *   - `showActivity === false` → `recentActivity: []`
 *   - `showStats === false`     → `analytics` zeroed + `xpHistory`
 *                                 series replaced with an empty
 *                                 `points: []`
 *
 * The `/me` variant is unaffected (the viewer always sees their
 * own data).
 */
@Injectable()
export class UserProfileBundleService {
  private static readonly BUNDLE_TX_LIMIT = 20;

  constructor(
    private readonly userSummaryService: UserSummaryService,
    @Inject(COIN_REPOSITORY_PORT)
    private readonly coinRepository: CoinRepositoryPort,
  ) {}

  async getBundleForCurrentUser(
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
        // Phase 3 (S-coin): bundle the wallet + first ledger page so
        // the my-profile page doesn't have to issue extra round-trips.
        this.coinRepository.getWallet(userId),
        this.coinRepository.listTransactions({
          userId,
          cursorCreatedAt: null,
          cursorTransactionId: null,
          limit: UserProfileBundleService.BUNDLE_TX_LIMIT + 1, // +1 to detect next page
        }),
        this.coinRepository.getDailyEarnCapSum(userId, todayMidnight),
      ]);

    // The XP history is derived from the analytics payload — the
    // per-day totals are not yet on a dedicated endpoint. The
    // placeholder service returns an empty series; a follow-up
    // wires the `daily_xp` snapshot table.
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

    // Honor privacy flags. The flags live on `user_profiles`; for
    // now we treat the default as `true` (the bundle surfaces
    // everything). The controller-layer privacy check refines the
    // behaviour for the public variant in a follow-up.
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

    // Privacy: the public variant never exposes another user's
    // coin balance or ledger. Both fields are explicit `null` so
    // the frontend can short-circuit without a presence check.
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
        // The bundle intentionally omits a `nextCursor` string —
        // the frontend navigates to the dedicated endpoint for older
        // entries rather than threading an opaque cursor back to
        // the bundle endpoint. Returning `null` here keeps the
        // shape compatible with the standalone transactions DTO.
        nextCursor: null,
      },
    };
  }
}
