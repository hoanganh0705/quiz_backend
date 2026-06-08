import { Controller, Delete, Get, Param, ParseUUIDPipe, UseFilters } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/authorization/decorators/roles.decorator';
import { ApiAuth } from '@/common/swagger/swagger-decorators';
import { AchievementApplicationService } from '../../application/achievement.application.service';
import { AchievementHistoryItemResponseDto } from '../../dto/response/achievement-history-item-response.dto';
import { BadgeCatalogItemResponseDto } from '../../dto/response/badge-catalog-item-response.dto';
import { BadgeDetailsResponseDto } from '../../dto/response/badge-details-response.dto';
import { BadgeProgressResponseDto } from '../../dto/response/badge-progress-response.dto';
import { PublicAchievementProfileResponseDto } from '../../dto/response/public-achievement-profile-response.dto';
import { UserBadgeAnalyticsResponseDto } from '../../dto/response/user-badge-analytics-response.dto';
import { AchievementDomainExceptionFilter } from '../filters/achievement-domain-exception.filter';

@ApiTags('achievements')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid authentication token' })
@Controller('achievements')
@UseFilters(AchievementDomainExceptionFilter)
export class AchievementController {
  constructor(private readonly achievementApplicationService: AchievementApplicationService) {}

  @Get('badges')
  @ApiOperation({
    summary: 'Get badge catalog',
    description: 'Returns the catalog of all available badges in the system.',
  })
  @ApiOkResponse({
    description: 'Badge catalog returned',
    type: BadgeCatalogItemResponseDto,
    isArray: true,
  })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  getBadgeCatalog(): Promise<BadgeCatalogItemResponseDto[]> {
    return this.achievementApplicationService.getBadgeCatalog();
  }

  @Get('badges/:badgeId')
  @ApiOperation({
    summary: 'Get badge details',
    description: 'Returns badge metadata and total earned count for the specified badge.',
  })
  @ApiOkResponse({ description: 'Badge details returned', type: BadgeDetailsResponseDto })
  @ApiNotFoundResponse({ description: 'Badge not found' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  getBadgeDetails(@Param('badgeId') badgeId: string): Promise<BadgeDetailsResponseDto> {
    return this.achievementApplicationService.getBadgeDetails(badgeId);
  }

  @Delete('/users/:userId/badges/:badgeId')
  @Roles('admin')
  @ApiBearerAuth()
  @ApiAuth()
  @ApiOperation({
    summary: 'Revoke a user badge',
    description: 'Revokes a badge from a user. Requires admin role.',
  })
  @ApiNoContentResponse({ description: 'Badge revoked successfully' })
  @ApiForbiddenResponse({ description: 'Authenticated user lacks required role or permission' })
  @ApiNotFoundResponse({ description: 'User, badge, or owned badge not found' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  async revokeUserBadge(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Param('badgeId') badgeId: string,
    @CurrentUser('sub') revokedBy: string,
  ): Promise<void> {
    await this.achievementApplicationService.revokeUserBadge(userId, badgeId, revokedBy);
  }

  @Get('/users/:userId/achievements')
  @ApiOperation({
    summary: 'Get public achievement profile',
    description: 'Returns a public achievement summary for the specified user.',
  })
  @ApiOkResponse({
    description: 'Public achievement profile returned',
    type: PublicAchievementProfileResponseDto,
  })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  getPublicAchievementProfile(
    @Param('userId', new ParseUUIDPipe()) userId: string,
  ): Promise<PublicAchievementProfileResponseDto> {
    return this.achievementApplicationService.getPublicAchievementProfile(userId);
  }

  @Get('/users/me/badges/:badgeId/progress')
  @ApiOperation({
    summary: 'Get my badge progress',
    description:
      "Returns the authenticated user's current progress toward earning the specified badge.",
  })
  @ApiOkResponse({ description: 'Badge progress returned', type: BadgeProgressResponseDto })
  @ApiNotFoundResponse({ description: 'Badge not found' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  getMyBadgeProgress(
    @CurrentUser('sub') userId: string,
    @Param('badgeId') badgeId: string,
  ): Promise<BadgeProgressResponseDto> {
    return this.achievementApplicationService.getMyBadgeProgress(userId, badgeId);
  }

  @Get('/users/me/achievements/history')
  @ApiOperation({
    summary: 'Get my achievement history',
    description:
      "Returns the authenticated user's achievement history ordered by most recent first.",
  })
  @ApiOkResponse({
    description: 'Achievement history returned',
    type: AchievementHistoryItemResponseDto,
    isArray: true,
  })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  getMyAchievementHistory(
    @CurrentUser('sub') userId: string,
  ): Promise<AchievementHistoryItemResponseDto[]> {
    return this.achievementApplicationService.getMyAchievementHistory(userId);
  }

  @Get('/users/me/badges/analytics')
  @ApiOperation({
    summary: 'Get my badge analytics',
    description: 'Returns badge analytics for the authenticated user.',
  })
  @ApiOkResponse({
    description: 'Badge analytics returned',
    type: UserBadgeAnalyticsResponseDto,
  })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  getMyBadgeAnalytics(@CurrentUser('sub') userId: string): Promise<UserBadgeAnalyticsResponseDto> {
    return this.achievementApplicationService.getMyBadgeAnalytics(userId);
  }
}
