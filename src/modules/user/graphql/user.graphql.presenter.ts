/**
 * Presentation for the user profile surface.
 *
 * Mapping is structural only: every business rule (privacy flags, block lists,
 * relationship gating) already lives in the application and domain services.
 * Two conversions are worth calling out:
 *
 * - `metadata` and `payload` are open-ended JSON. They are projected onto the
 *   set of keys rather than the values, because a GraphQL schema has to name
 *   its field types and the values are attacker-influenced.
 * - Every nullable read is coalesced to `null` so a partially populated row
 *   cannot null out a non-null schema field.
 */
import type { TimeSeriesDto } from '@/modules/user/dto/response/time-series.dto';
import type {
  UserActivityItemDto,
  UserActivityResponseDto,
} from '@/modules/user/dto/response/user-activity.dto';
import type {
  UserAnalyticsResponseDto,
  UserAnalyticsSummaryDto,
} from '@/modules/user/dto/response/user-analytics.dto';
import type { UserProfileBundleResponseDto } from '@/modules/user/dto/response/user-profile-bundle.dto';
import type { UserSummaryResponseDto } from '@/modules/user/dto/response/user-summary.dto';
import type { CoinWalletResponseDto } from '@/modules/coins/dto/response/coin-wallet.dto';
import type { PaginatedResult } from '@/common/responses/paginated-result';
import { isCursorPagination } from '@/common/responses/pagination';
import type {
  PaginatedFollowersResult,
  PaginatedFollowingResult,
  PaginatedUserActivityResult,
} from '@/modules/social/domain/types/social.types';

import type {
  ActivityActorGql,
  SocialActivityConnectionGql,
  SocialActivityItemGql,
  SocialConnectionConnectionGql,
  SocialConnectionGql,
  UserActivityItemGql,
  UserAnalyticsGql,
  UserAnalyticsTotalsGql,
  UserCoinWalletGql,
  UserPageInfoGql,
  UserSummaryGql,
  UserXpHistoryGql,
  UserXpPointGql,
} from './user.graphql.types';

export type PresentedUserProfile = {
  summary: UserSummaryGql;
  analytics: UserAnalyticsGql | null;
  xpHistory: UserXpHistoryGql | null;
  recentActivity: UserActivityItemGql[] | null;
  wallet: UserCoinWalletGql | null;
};

/**
 * Cursor metadata is the only pagination kind these connections produce. An
 * offset envelope would have no `nextCursor`, so it degrades to a null cursor
 * rather than surfacing a number where a cursor belongs.
 */
const toPageInfo = (result: PaginatedResult<unknown>): UserPageInfoGql => {
  const { pagination } = result;
  if (!isCursorPagination(pagination)) {
    return { limit: 0, nextCursor: null, hasNextPage: false };
  }
  return {
    limit: pagination.limit,
    nextCursor: pagination.nextCursor,
    hasNextPage: pagination.hasNextPage,
  };
};

const toSummary = (summary: UserSummaryResponseDto): UserSummaryGql => ({
  userId: summary.userId,
  username: summary.username,
  displayName: summary.displayName ?? null,
  avatarUrl: summary.avatarUrl ?? null,
  bio: summary.bio ?? null,
  country: summary.country ?? null,
  countryCode: summary.countryCode ?? null,
  bgImageUrl: summary.bgImageUrl ?? null,
  createdAt: summary.createdAt,
  updatedAt: summary.updatedAt,
  xpTotal: summary.xpTotal,
  level: summary.level,
  currentLevelXP: summary.currentLevelXP,
  nextLevelXP: summary.nextLevelXP,
  xpProgressPercent: summary.xpProgressPercent,
  levelTitle: summary.levelTitle,
  levelTitleLocalised: summary.levelTitleLocalised,
  currentStreak: summary.currentStreak,
  longestStreak: summary.longestStreak,
  quizzesCreated: summary.quizzesCreated,
  quizzesPublished: summary.quizzesPublished,
  quizzesTaken: summary.quizzesTaken,
  followers: summary.followers,
  following: summary.following,
  friends: summary.friends,
  coinBalance: summary.coinBalance,
});

const toAnalyticsTotals = (summary: UserAnalyticsSummaryDto): UserAnalyticsTotalsGql => ({
  totalAttempts: summary.totalAttempts,
  completedQuizzes: summary.completedQuizzes,
  averageScore: summary.averageScore,
});

const toAnalytics = (analytics: UserAnalyticsResponseDto): UserAnalyticsGql => ({
  userId: analytics.userId,
  summary: toAnalyticsTotals(analytics.summary),
  favoriteCategory: analytics.favoriteCategory
    ? { id: analytics.favoriteCategory.categoryId, name: analytics.favoriteCategory.name }
    : null,
  favoriteTag: analytics.favoriteTag
    ? { id: analytics.favoriteTag.tagId, name: analytics.favoriteTag.name }
    : null,
  lastUpdated: analytics.lastUpdated,
});

const toXpPoint = (point: TimeSeriesDto['points'][number]): UserXpPointGql => ({
  date: point.date,
  value: point.value,
});

const toXpHistory = (series: TimeSeriesDto): UserXpHistoryGql => ({
  bucket: series.bucket,
  unit: series.unit,
  points: series.points.map(toXpPoint),
});

/**
 * The metadata bag is open-ended, so only its key set is exposed. A null bag
 * stays null to distinguish "no metadata" from "metadata with no fields".
 */
const toActivityItem = (item: UserActivityItemDto): UserActivityItemGql => ({
  eventId: item.eventId,
  eventType: item.eventType,
  createdAt: item.createdAt,
  metadataKeys: item.metadata ? Object.keys(item.metadata) : null,
});

const toWallet = (wallet: CoinWalletResponseDto): UserCoinWalletGql => ({
  balance: wallet.balance,
  createdAt: wallet.createdAt,
  updatedAt: wallet.updatedAt,
  lastTransactionAt: wallet.lastTransactionAt ?? null,
  earnedToday: wallet.earnedToday,
  dailyEarnCap: wallet.dailyEarnCap,
});

/**
 * Projects the bundle onto the schema. `revealPrivateFields` is the single
 * switch that separates an anonymous read from an authenticated one: the
 * bundle service already computed every field, so an anonymous caller is
 * withheld them here rather than paying for work whose result is discarded.
 */
export const presentUserProfile = (
  bundle: UserProfileBundleResponseDto,
  revealPrivateFields: boolean,
): PresentedUserProfile => ({
  summary: toSummary(bundle.summary),
  analytics: revealPrivateFields ? toAnalytics(bundle.analytics) : null,
  xpHistory: revealPrivateFields ? toXpHistory(bundle.xpHistory) : null,
  recentActivity: revealPrivateFields ? bundle.recentActivity.map(toActivityItem) : null,
  wallet: bundle.wallet ? toWallet(bundle.wallet) : null,
});

const toConnectionItem = (row: SocialConnectionGql): SocialConnectionGql => ({
  userId: row.userId,
  username: row.username,
  avatarUrl: row.avatarUrl ?? null,
  followedAt: row.followedAt,
});

const toActor = (actor: ActivityActorGql | null): ActivityActorGql | null =>
  actor
    ? {
        userId: actor.userId,
        username: actor.username,
        displayName: actor.displayName ?? null,
        avatarUrl: actor.avatarUrl ?? null,
      }
    : null;

export const presentFollowers = (
  result: PaginatedResult<PaginatedFollowersResult['items'][number]>,
): SocialConnectionConnectionGql => ({
  items: result.items.map(toConnectionItem),
  pageInfo: toPageInfo(result),
});

export const presentFollowing = (
  result: PaginatedResult<PaginatedFollowingResult['items'][number]>,
): SocialConnectionConnectionGql => ({
  items: result.items.map(toConnectionItem),
  pageInfo: toPageInfo(result),
});

export const presentActivity = (
  result: PaginatedResult<PaginatedUserActivityResult['items'][number]>,
): SocialActivityConnectionGql => ({
  items: result.items.map((item): SocialActivityItemGql => ({
    id: item.id,
    type: item.type,
    occurredAt: item.occurredAt,
    actor: toActor(item.actor),
  })),
  pageInfo: toPageInfo(result),
});

export const presentUserActivity = (result: UserActivityResponseDto): UserActivityItemGql[] =>
  result.items.map(toActivityItem);
