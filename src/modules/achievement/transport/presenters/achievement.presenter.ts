import { Injectable } from '@nestjs/common';
import { ApiResponse } from '@/common/responses/api-response';
import type { ApiResponseEnvelope } from '@/common/responses/api-response';
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

/**
 * Presenter for the achievement module. Wraps every application-service
 * response in the canonical `{ data, meta.timestamp }` envelope.
 *
 * One presenter method per endpoint keeps `git grep presenter.<name>` a
 * reliable index of which controllers have been migrated.
 *
 * The catalog/my-badges/history endpoints previously returned a doubly-nested
 * `{ data: T[], total }` shape (E-variant). They have been flattened to bare
 * `T[]` at the application-service layer and are wrapped as bare arrays here.
 */
@Injectable()
export class AchievementPresenter {
  private static readonly ok = <T>(payload: T): ApiResponseEnvelope<T> => ApiResponse.ok(payload);

  // Single-resource endpoints — wrap whole DTO as `data`.
  readonly getBadgeDetails = AchievementPresenter.ok<BadgeDetailsResponseDto>;
  readonly getPublicAchievementProfile =
    AchievementPresenter.ok<PublicAchievementProfileResponseDto>;
  readonly getMyBadgeProgress = AchievementPresenter.ok<BadgeProgressResponseDto>;
  readonly getMyBadgeAnalytics = AchievementPresenter.ok<UserBadgeAnalyticsResponseDto>;
  readonly reevaluateUser = AchievementPresenter.ok<ReevaluateUserResponseDto>;

  // Bare-array endpoints — service returns `T[]` directly, presenter wraps.
  readonly getBadgeCatalog = (items: BadgeCatalogItemResponseDto[]) => ApiResponse.ok([...items]);
  readonly getMyBadges = (items: MyBadgeItemDto[]) => ApiResponse.ok([...items]);
  readonly getMyAchievementHistory = (items: AchievementHistoryItemResponseDto[]) =>
    ApiResponse.ok([...items]);
  readonly getUserHistory = (items: AdminAchievementHistoryItemDto[]) => ApiResponse.ok([...items]);
}
