import { Injectable } from '@nestjs/common';
import { ApiResponse } from '@/common/responses/api-response';
import type { ApiResponseEnvelope } from '@/common/responses/api-response';
import { OffsetPagination } from '@/common/responses/pagination';
import type { BadgeDetailsResponseDto } from '../../dto/response/badge-details-response.dto';
import type { BadgeProgressResponseDto } from '../../dto/response/badge-progress-response.dto';
import type { AchievementHistoryItemResponseDto } from '../../dto/response/achievement-history-item-response.dto';
import type { UserBadgeAnalyticsResponseDto } from '../../dto/response/user-badge-analytics-response.dto';
import type { BadgeCatalogItemResponseDto } from '../../dto/response/badge-catalog-item-response.dto';
import type { MyBadgeItemDto } from '../../dto/response/my-badges-response.dto';
import type { PublicAchievementProfileResponseDto } from '../../dto/response/public-achievement-profile-response.dto';
import type {
  AdminAchievementHistoryItemDto,
  ReevaluateUserResponseDto,
} from '../../dto/response/achievement-admin-response.dto';

export interface PaginatedAchievementItems<T> {
  items: T[];
  total: number;
  limit?: number;
  offset?: number;
}

/**
 * Presenter for the achievement module. Wraps every application-service
 * response in the canonical `{ data, meta.timestamp }` envelope.
 *
 * One presenter method per endpoint keeps `git grep presenter.<name>` a
 * reliable index of which controllers have been migrated.
 *
 * Paginated endpoints use `ApiResponse.page()` with `OffsetPagination`:
 * - badge catalog
 * - my badges
 * - achievement history
 */
@Injectable()
export class AchievementPresenter {
  private static readonly ok = <T>(payload: T): ApiResponseEnvelope<T> => ApiResponse.ok(payload);

  private static offsetPaginate<T>(
    payload: PaginatedAchievementItems<T>,
    defaultLimit: number,
  ): ApiResponseEnvelope<T[]> {
    const limit = payload.limit ?? defaultLimit;
    const offset = payload.offset ?? 0;
    const page = Math.floor(offset / limit) + 1;
    const pagination: OffsetPagination = {
      kind: 'offset',
      page,
      limit,
      total: payload.total,
      hasMore: offset + payload.items.length < payload.total,
    };
    return ApiResponse.page(payload.items, pagination);
  }

  // Single-resource endpoints — wrap whole DTO as `data`.
  readonly getBadgeDetails = AchievementPresenter.ok<BadgeDetailsResponseDto>;
  readonly getPublicAchievementProfile =
    AchievementPresenter.ok<PublicAchievementProfileResponseDto>;
  readonly getMyBadgeProgress = AchievementPresenter.ok<BadgeProgressResponseDto>;
  readonly getMyBadgeAnalytics = AchievementPresenter.ok<UserBadgeAnalyticsResponseDto>;
  readonly reevaluateUser = AchievementPresenter.ok<ReevaluateUserResponseDto>;

  // Paginated endpoints — use OffsetPagination for proper meta.pagination
  readonly getBadgeCatalog = (payload: PaginatedAchievementItems<BadgeCatalogItemResponseDto>) =>
    AchievementPresenter.offsetPaginate(payload, 20);

  readonly getMyBadges = (payload: PaginatedAchievementItems<MyBadgeItemDto>) =>
    AchievementPresenter.offsetPaginate(payload, 20);

  readonly getMyAchievementHistory = (
    payload: PaginatedAchievementItems<AchievementHistoryItemResponseDto>,
  ) => AchievementPresenter.offsetPaginate(payload, 50);

  readonly getUserHistory = (payload: PaginatedAchievementItems<AdminAchievementHistoryItemDto>) =>
    AchievementPresenter.offsetPaginate(payload, 50);
}
