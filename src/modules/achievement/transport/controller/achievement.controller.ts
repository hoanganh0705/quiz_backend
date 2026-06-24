import { Controller, Delete, Get, Param, ParseUUIDPipe, Query, UseFilters } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Permissions } from '@/common/authorization/decorators/permissions.decorator';
import { Permission } from '@/common/authorization/permissions';
import {
  ApiAuth,
  ApiAuthList,
  ApiAuthDelete,
  ApiPublicList,
  ApiInternalError,
} from '@/common/swagger/swagger-decorators';
import { AchievementApplicationService } from '../../application/achievement.application.service';
import { AchievementHistoryItemResponseDto } from '../../dto/response/achievement-history-item-response.dto';
import { BadgeCatalogItemResponseDto } from '../../dto/response/badge-catalog-item-response.dto';
import { MyBadgesResponseDto } from '../../dto/response/my-badges-response.dto';
import { BadgeDetailsResponseDto } from '../../dto/response/badge-details-response.dto';
import { BadgeProgressResponseDto } from '../../dto/response/badge-progress-response.dto';
import { PublicAchievementProfileResponseDto } from '../../dto/response/public-achievement-profile-response.dto';
import { UserBadgeAnalyticsResponseDto } from '../../dto/response/user-badge-analytics-response.dto';
import { AchievementDomainExceptionFilter } from '../filters/achievement-domain-exception.filter';

export interface PaginationQuery {
  limit?: number;
  offset?: number;
}

@ApiTags('achievements')
@Controller('achievements')
@UseFilters(AchievementDomainExceptionFilter)
export class AchievementController {
  constructor(private readonly achievementApplicationService: AchievementApplicationService) {}

  @Get('badges')
  @ApiPublicList({
    description: 'Badge catalog returned',
    type: BadgeCatalogItemResponseDto,
    isArray: true,
  })
  @ApiInternalError()
  getBadgeCatalog(@Query() query: PaginationQuery): Promise<{
    data: BadgeCatalogItemResponseDto[];
    total: number;
  }> {
    return this.achievementApplicationService.getBadgeCatalog(query);
  }

  @Get('me/badges')
  @ApiAuthList({ description: 'User badges returned', type: MyBadgesResponseDto })
  @ApiInternalError()
  getMyBadges(
    @CurrentUser('sub') userId: string,
    @Query() query: PaginationQuery,
  ): Promise<MyBadgesResponseDto> {
    return this.achievementApplicationService.getMyBadges(userId, query);
  }

  @Get('badges/:badgeId')
  @ApiPublicList({ description: 'Badge details returned', type: BadgeDetailsResponseDto })
  @ApiInternalError()
  getBadgeDetails(
    @Param('badgeId', new ParseUUIDPipe()) badgeId: string,
  ): Promise<BadgeDetailsResponseDto> {
    return this.achievementApplicationService.getBadgeDetails(badgeId);
  }

  @Delete('/users/:userId/badges/:badgeId')
  @Permissions(Permission.ACHIEVEMENT_REVOKE)
  @ApiAuth()
  @ApiAuthDelete('Badge revoked successfully')
  @ApiInternalError()
  async revokeUserBadge(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Param('badgeId', new ParseUUIDPipe()) badgeId: string,
    @CurrentUser('sub') revokedBy: string,
  ): Promise<void> {
    await this.achievementApplicationService.revokeUserBadge(userId, badgeId, revokedBy);
  }

  @Get('/users/:userId/achievements')
  @ApiAuthList({
    description: 'Public achievement profile returned',
    type: PublicAchievementProfileResponseDto,
  })
  @ApiInternalError()
  getPublicAchievementProfile(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @CurrentUser('sub') requesterId: string,
  ): Promise<PublicAchievementProfileResponseDto> {
    return this.achievementApplicationService.getPublicAchievementProfile(userId, requesterId);
  }

  @Get('/users/me/badges/:badgeId/progress')
  @ApiAuthList({ description: 'Badge progress returned', type: BadgeProgressResponseDto })
  @ApiInternalError()
  getMyBadgeProgress(
    @CurrentUser('sub') userId: string,
    @Param('badgeId', new ParseUUIDPipe()) badgeId: string,
  ): Promise<BadgeProgressResponseDto> {
    return this.achievementApplicationService.getMyBadgeProgress(userId, badgeId);
  }

  @Get('/users/me/achievements/history')
  @ApiAuthList({
    description: 'Achievement history returned',
    type: AchievementHistoryItemResponseDto,
    isArray: true,
  })
  @ApiInternalError()
  getMyAchievementHistory(
    @CurrentUser('sub') userId: string,
    @Query() query: PaginationQuery,
  ): Promise<{ data: AchievementHistoryItemResponseDto[]; total: number }> {
    return this.achievementApplicationService.getMyAchievementHistory(userId, query);
  }

  @Get('/users/me/badges/analytics')
  @ApiAuthList({ description: 'Badge analytics returned', type: UserBadgeAnalyticsResponseDto })
  @ApiInternalError()
  getMyBadgeAnalytics(@CurrentUser('sub') userId: string): Promise<UserBadgeAnalyticsResponseDto> {
    return this.achievementApplicationService.getMyBadgeAnalytics(userId);
  }
}
