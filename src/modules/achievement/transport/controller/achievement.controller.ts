import { Controller, Delete, Get, Param, ParseUUIDPipe, Query, UseFilters } from '@nestjs/common';
import {
  ApiTags,
  ApiQuery,
  ApiNotFoundResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Permissions } from '@/common/authorization/decorators/permissions.decorator';
import { Permission } from '@/common/authorization/permissions';
import { ApiAuth } from '@/common/swagger/swagger-decorators';
import { AchievementApplicationService } from '../../application/achievement.application.service';
import { AchievementHistoryItemResponseDto } from '../../dto/response/achievement-history-item-response.dto';
import { BadgeCatalogItemResponseDto } from '../../dto/response/badge-catalog-item-response.dto';
import { MyBadgesResponseDto } from '../../dto/response/my-badges-response.dto';
import { BadgeDetailsResponseDto } from '../../dto/response/badge-details-response.dto';
import { BadgeProgressResponseDto } from '../../dto/response/badge-progress-response.dto';
import { PublicAchievementProfileResponseDto } from '../../dto/response/public-achievement-profile-response.dto';
import { UserBadgeAnalyticsResponseDto } from '../../dto/response/user-badge-analytics-response.dto';
import {
  WrappedBadgeCatalogResponseDto,
  WrappedMyBadgesResponseDto,
  WrappedBadgeDetailsResponseDto,
  WrappedPublicAchievementProfileResponseDto,
  WrappedBadgeProgressResponseDto,
  WrappedAchievementHistoryResponseDto,
  WrappedUserBadgeAnalyticsResponseDto,
  WrappedRevokeBadgeResponseDto,
} from '../../dto/response/achievement-response-docs.dto';
import { AchievementDomainExceptionFilter } from '../filters/achievement-domain-exception.filter';

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

@ApiTags('achievements')
@Controller('achievements')
@UseFilters(AchievementDomainExceptionFilter)
export class AchievementController {
  constructor(private readonly achievementApplicationService: AchievementApplicationService) {}

  @Get('badges')
  @ApiOkResponse({ description: 'Badge catalog returned', type: WrappedBadgeCatalogResponseDto })
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
  getBadgeCatalog(@Query() query: PaginationQueryDto): Promise<{
    data: BadgeCatalogItemResponseDto[];
    total: number;
  }> {
    return this.achievementApplicationService.getBadgeCatalog(query);
  }

  @Get('me/badges')
  @ApiAuth()
  @ApiOkResponse({ description: 'User badges returned', type: WrappedMyBadgesResponseDto })
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
  getMyBadges(
    @CurrentUser('sub') userId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<MyBadgesResponseDto> {
    return this.achievementApplicationService.getMyBadges(userId, query);
  }

  @Get('badges/:badgeId')
  @ApiOkResponse({ description: 'Badge details returned', type: WrappedBadgeDetailsResponseDto })
  @ApiNotFoundResponse({ description: 'Badge not found' })
  getBadgeDetails(
    @Param('badgeId', new ParseUUIDPipe()) badgeId: string,
  ): Promise<BadgeDetailsResponseDto> {
    return this.achievementApplicationService.getBadgeDetails(badgeId);
  }

  @Delete('/users/:userId/badges/:badgeId')
  @Permissions(Permission.ACHIEVEMENT_REVOKE)
  @ApiAuth()
  @ApiOkResponse({
    description: 'Badge revoked successfully',
    type: WrappedRevokeBadgeResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Badge not found, user not found, or user does not own the badge',
  })
  async revokeUserBadge(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Param('badgeId', new ParseUUIDPipe()) badgeId: string,
    @CurrentUser('sub') revokedBy: string,
  ): Promise<void> {
    await this.achievementApplicationService.revokeUserBadge(userId, badgeId, revokedBy);
  }

  @Get('/users/:userId/achievements')
  @ApiAuth()
  @ApiOkResponse({
    description: 'Public achievement profile returned',
    type: WrappedPublicAchievementProfileResponseDto,
  })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiForbiddenResponse({ description: 'Profile is private' })
  getPublicAchievementProfile(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @CurrentUser('sub') requesterId: string,
  ): Promise<PublicAchievementProfileResponseDto> {
    return this.achievementApplicationService.getPublicAchievementProfile(userId, requesterId);
  }

  @Get('/users/me/badges/:badgeId/progress')
  @ApiAuth()
  @ApiOkResponse({
    description: 'Badge progress returned',
    type: WrappedBadgeProgressResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Badge not found' })
  getMyBadgeProgress(
    @CurrentUser('sub') userId: string,
    @Param('badgeId', new ParseUUIDPipe()) badgeId: string,
  ): Promise<BadgeProgressResponseDto> {
    return this.achievementApplicationService.getMyBadgeProgress(userId, badgeId);
  }

  @Get('/users/me/achievements/history')
  @ApiAuth()
  @ApiOkResponse({
    description: 'Achievement history returned',
    type: WrappedAchievementHistoryResponseDto,
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
  getMyAchievementHistory(
    @CurrentUser('sub') userId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<{ data: AchievementHistoryItemResponseDto[]; total: number }> {
    return this.achievementApplicationService.getMyAchievementHistory(userId, query);
  }

  @Get('/users/me/badges/analytics')
  @ApiAuth()
  @ApiOkResponse({
    description: 'Badge analytics returned',
    type: WrappedUserBadgeAnalyticsResponseDto,
  })
  getMyBadgeAnalytics(@CurrentUser('sub') userId: string): Promise<UserBadgeAnalyticsResponseDto> {
    return this.achievementApplicationService.getMyBadgeAnalytics(userId);
  }
}
