import { Controller, Delete, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiQuery, ApiTags } from '@nestjs/swagger';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Permissions } from '@/common/authorization/decorators/permissions.decorator';
import { Permission } from '@/common/authorization/permissions';
import { ApiAuth, ApiNotFound } from '@/common/swagger/swagger-decorators';
import { ApiOkResource } from '@/common/swagger/api-ok';
import { AchievementApplicationService } from '../../application/achievement.application.service';
import { AchievementPresenter } from '../presenters/achievement.presenter';
import { BadgeDetailsResponseDto } from '../../dto/response/badge-details-response.dto';
import { BadgeProgressResponseDto } from '../../dto/response/badge-progress-response.dto';
import { BadgeCatalogItemResponseDto } from '../../dto/response/badge-catalog-item-response.dto';
import { MyBadgeItemDto } from '../../dto/response/my-badges-response.dto';
import { PublicAchievementProfileResponseDto } from '../../dto/response/public-achievement-profile-response.dto';
import { UserBadgeAnalyticsResponseDto } from '../../dto/response/user-badge-analytics-response.dto';
import { AchievementHistoryItemResponseDto } from '../../dto/response/achievement-history-item-response.dto';

export class PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Maximum number of items to return (1–100)',
    type: Number,
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Number of items to skip for offset-based pagination',
    type: Number,
    minimum: 0,
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}

// All 404/403/500 error responses (BadgeNotFoundError,
// AchievementUserNotFoundError, UserBadgeOwnershipNotFoundError → 404;
// AchievementGrantError → 500; UserProfilePrivateError → 403 — handled
// by the global filter via USER_PROFILE_PRIVATE mapping entry) flow
// through `GlobalExceptionFilter` as RFC 7807 `ProblemDetailDto` after
// Phase 2. The per-module `AchievementDomainExceptionFilter` and its
// `@UseFilters(...)` decorator have been removed.

@ApiTags('achievements')
@Controller('achievements')
export class AchievementController {
  constructor(
    private readonly achievementApplicationService: AchievementApplicationService,
    private readonly presenter: AchievementPresenter,
  ) {}

  @Get('badges')
  @ApiOkResource(BadgeCatalogItemResponseDto, {
    description: 'Badge catalog returned',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Maximum number of items to return (1–100)',
    schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    description: 'Number of items to skip',
    schema: { type: 'integer', minimum: 0, default: 0 },
  })
  async getBadgeCatalog(@Query() query: PaginationQueryDto) {
    const items = await this.achievementApplicationService.getBadgeCatalog(query);
    return this.presenter.getBadgeCatalog(items);
  }

  @Get('me/badges')
  @ApiAuth()
  @ApiOkResource(MyBadgeItemDto, { description: 'User badges returned' })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Maximum number of items to return (1–100)',
    schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    description: 'Number of items to skip',
    schema: { type: 'integer', minimum: 0, default: 0 },
  })
  async getMyBadges(@CurrentUser('sub') userId: string, @Query() query: PaginationQueryDto) {
    const items = await this.achievementApplicationService.getMyBadges(userId, query);
    return this.presenter.getMyBadges(items);
  }

  @Get('badges/:badgeId')
  @ApiOkResource(BadgeDetailsResponseDto, { description: 'Badge details returned' })
  @ApiNotFound('Badge not found')
  async getBadgeDetails(@Param('badgeId', new ParseUUIDPipe()) badgeId: string) {
    const result = await this.achievementApplicationService.getBadgeDetails(badgeId);
    return this.presenter.getBadgeDetails(result);
  }

  @Delete('/users/:userId/badges/:badgeId')
  @Permissions(Permission.ACHIEVEMENT_REVOKE)
  @ApiAuth()
  async revokeUserBadge(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Param('badgeId', new ParseUUIDPipe()) badgeId: string,
    @CurrentUser('sub') revokedBy: string,
  ): Promise<void> {
    await this.achievementApplicationService.revokeUserBadge(userId, badgeId, revokedBy);
  }

  @Get('/users/:userId/achievements')
  @ApiAuth()
  @ApiOkResource(PublicAchievementProfileResponseDto, {
    description: 'Public achievement profile returned',
  })
  @ApiNotFound('User not found')
  async getPublicAchievementProfile(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @CurrentUser('sub') requesterId: string,
  ) {
    const result = await this.achievementApplicationService.getPublicAchievementProfile(
      userId,
      requesterId,
    );
    return this.presenter.getPublicAchievementProfile(result);
  }

  @Get('/users/me/badges/:badgeId/progress')
  @ApiAuth()
  @ApiOkResource(BadgeProgressResponseDto, { description: 'Badge progress returned' })
  @ApiNotFound('Badge not found')
  async getMyBadgeProgress(
    @CurrentUser('sub') userId: string,
    @Param('badgeId', new ParseUUIDPipe()) badgeId: string,
  ) {
    const result = await this.achievementApplicationService.getMyBadgeProgress(userId, badgeId);
    return this.presenter.getMyBadgeProgress(result);
  }

  @Get('/users/me/achievements/history')
  @ApiAuth()
  @ApiOkResource(AchievementHistoryItemResponseDto, {
    description: 'Achievement history returned',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Maximum number of items to return (1–100)',
    schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    description: 'Number of items to skip',
    schema: { type: 'integer', minimum: 0, default: 0 },
  })
  async getMyAchievementHistory(
    @CurrentUser('sub') userId: string,
    @Query() query: PaginationQueryDto,
  ) {
    const items = await this.achievementApplicationService.getMyAchievementHistory(userId, query);
    return this.presenter.getMyAchievementHistory(items);
  }

  @Get('/users/me/badges/analytics')
  @ApiAuth()
  @ApiOkResource(UserBadgeAnalyticsResponseDto, {
    description: 'Badge analytics returned',
  })
  async getMyBadgeAnalytics(@CurrentUser('sub') userId: string) {
    const result = await this.achievementApplicationService.getMyBadgeAnalytics(userId);
    return this.presenter.getMyBadgeAnalytics(result);
  }
}
