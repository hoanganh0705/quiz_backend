import { Controller, Delete, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiParam, ApiQuery, ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Public } from '@/common/decorators/public.decorator';
import { Permissions } from '@/common/authorization/decorators/permissions.decorator';
import { Permission } from '@/common/authorization/permissions';
import { JwtGuard } from '@/common/guards/jwt.guard';
import { ApiForbidden, ApiAuth, ApiNotFound } from '@/common/swagger/swagger-decorators';
import { ApiOkResource, ApiOkResourceList } from '@/common/swagger/api-ok';
import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';
import { ACHIEVEMENT_THROTTLE_VALUES } from '@/core/config/achievement-throttle.config';
import { AchievementApplicationService } from '../../application/achievement.application.service';
import { AchievementPresenter } from '../presenters/achievement.presenter';
import { BadgeDetailsResponseDto } from '../../dto/response/badge-details-response.dto';
import { BadgeProgressResponseDto } from '../../dto/response/badge-progress-response.dto';
import { BadgeCatalogItemResponseDto } from '../../dto/response/badge-catalog-item-response.dto';
import { MyBadgeItemDto } from '../../dto/response/my-badges-response.dto';
import { PublicAchievementProfileResponseDto } from '../../dto/response/public-achievement-profile-response.dto';
import { UserBadgeAnalyticsResponseDto } from '../../dto/response/user-badge-analytics-response.dto';
import { AchievementHistoryItemResponseDto } from '../../dto/response/achievement-history-item-response.dto';

@ApiTags('achievements')
@Controller('achievements')
export class AchievementController {
  constructor(
    private readonly achievementApplicationService: AchievementApplicationService,
    private readonly presenter: AchievementPresenter,
  ) {}

  @Get('badges')
  @Public()
  @Throttle({ default: ACHIEVEMENT_THROTTLE_VALUES.listBadgeCatalog })
  @ApiOperation({
    operationId: 'listBadgeCatalog',
    summary: 'List all available badges',
  })
  @ApiOkResourceList(BadgeCatalogItemResponseDto, 'offset', {
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
  @UseGuards(JwtGuard)
  @Throttle({ default: ACHIEVEMENT_THROTTLE_VALUES.getMyBadges })
  @ApiAuth()
  @ApiOperation({
    operationId: 'listMyBadges',
    summary: 'List badges earned by the authenticated user',
  })
  @ApiOkResourceList(MyBadgeItemDto, 'offset', { description: 'User badges returned' })
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
  @Public()
  @Throttle({ default: ACHIEVEMENT_THROTTLE_VALUES.getBadgeDetails })
  @ApiOperation({
    operationId: 'getBadgeDetails',
    summary: 'Get badge details',
  })
  @ApiParam({ name: 'badgeId', format: 'uuid' })
  @ApiOkResource(BadgeDetailsResponseDto, { description: 'Badge details returned' })
  @ApiNotFound('Badge not found')
  async getBadgeDetails(@Param('badgeId', new ParseUUIDPipe({ version: '7' })) badgeId: string) {
    const result = await this.achievementApplicationService.getBadgeDetails(badgeId);
    return this.presenter.getBadgeDetails(result);
  }

  @Delete('/users/:userId/badges/:badgeId')
  @UseGuards(JwtGuard)
  @Permissions(Permission.ACHIEVEMENT_REVOKE)
  @Throttle({ default: ACHIEVEMENT_THROTTLE_VALUES.revokeUserBadge })
  @ApiAuth()
  @ApiForbidden()
  @ApiOperation({
    operationId: 'revokeUserBadge',
    summary: 'Revoke a badge from a user',
  })
  @ApiParam({ name: 'userId', format: 'uuid' })
  @ApiParam({ name: 'badgeId', format: 'uuid' })
  async revokeUserBadge(
    @Param('userId', new ParseUUIDPipe({ version: '7' })) userId: string,
    @Param('badgeId', new ParseUUIDPipe({ version: '7' })) badgeId: string,
    @CurrentUser('sub') revokedBy: string,
  ): Promise<void> {
    await this.achievementApplicationService.revokeUserBadge(userId, badgeId, revokedBy);
  }

  @Get('/users/:userId/achievements')
  @UseGuards(JwtGuard)
  @Throttle({ default: ACHIEVEMENT_THROTTLE_VALUES.getPublicAchievementProfile })
  @ApiAuth()
  @ApiOperation({
    operationId: 'getPublicAchievementProfile',
    summary: "Get a user's public achievement profile",
  })
  @ApiParam({ name: 'userId', format: 'uuid' })
  @ApiOkResource(PublicAchievementProfileResponseDto, {
    description: 'Public achievement profile returned',
  })
  @ApiNotFound('User not found')
  async getPublicAchievementProfile(
    @Param('userId', new ParseUUIDPipe({ version: '7' })) userId: string,
    @CurrentUser('sub') requesterId: string,
  ) {
    const result = await this.achievementApplicationService.getPublicAchievementProfile(
      userId,
      requesterId,
    );
    return this.presenter.getPublicAchievementProfile(result);
  }

  @Get('/users/me/badges/:badgeId/progress')
  @UseGuards(JwtGuard)
  @Throttle({ default: ACHIEVEMENT_THROTTLE_VALUES.getMyBadgeProgress })
  @ApiAuth()
  @ApiOperation({
    operationId: 'getMyBadgeProgress',
    summary: "Get the authenticated user's progress toward a badge",
  })
  @ApiParam({ name: 'badgeId', format: 'uuid' })
  @ApiOkResource(BadgeProgressResponseDto, { description: 'Badge progress returned' })
  @ApiNotFound('Badge not found')
  async getMyBadgeProgress(
    @CurrentUser('sub') userId: string,
    @Param('badgeId', new ParseUUIDPipe({ version: '7' })) badgeId: string,
  ) {
    const result = await this.achievementApplicationService.getMyBadgeProgress(userId, badgeId);
    return this.presenter.getMyBadgeProgress(result);
  }

  @Get('/users/me/achievements/history')
  @UseGuards(JwtGuard)
  @Throttle({ default: ACHIEVEMENT_THROTTLE_VALUES.getMyAchievementHistory })
  @ApiAuth()
  @ApiOperation({
    operationId: 'getMyAchievementHistory',
    summary: "Get the authenticated user's badge earning history",
  })
  @ApiOkResourceList(AchievementHistoryItemResponseDto, 'offset', {
    description: 'Achievement history returned',
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
  async getMyAchievementHistory(
    @CurrentUser('sub') userId: string,
    @Query() query: PaginationQueryDto,
  ) {
    const items = await this.achievementApplicationService.getMyAchievementHistory(userId, query);
    return this.presenter.getMyAchievementHistory(items);
  }

  @Get('/users/me/badges/analytics')
  @UseGuards(JwtGuard)
  @Throttle({ default: ACHIEVEMENT_THROTTLE_VALUES.getMyBadgeAnalytics })
  @ApiAuth()
  @ApiOperation({
    operationId: 'getMyBadgeAnalytics',
    summary: "Get the authenticated user's badge analytics",
  })
  @ApiOkResource(UserBadgeAnalyticsResponseDto, {
    description: 'Badge analytics returned',
  })
  async getMyBadgeAnalytics(@CurrentUser('sub') userId: string) {
    const result = await this.achievementApplicationService.getMyBadgeAnalytics(userId);
    return this.presenter.getMyBadgeAnalytics(result);
  }
}
