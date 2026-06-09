import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  Body,
  UseFilters,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { SocialApplicationService } from '@/modules/social/application/social-application.service';
import {
  FriendRequestDto,
  FriendDto,
  FollowerDto,
  FollowingDto,
  SocialCountsDto,
  RelationshipStatusDto,
  BlockedUserDto,
  SearchableUserDto,
  FriendLeaderboardDto,
  UserFollowersResponseDto,
  UserFollowingResponseDto,
  SocialSuggestionsResponseDto,
  MutualFriendsResponseDto,
  MutualFollowersResponseDto,
  SocialFeedResponseDto,
  UserActivityResponseDto,
  UserSocialStatsResponseDto,
  MySocialAnalyticsResponseDto,
  TrendingUsersListResponseDto,
} from '@/modules/social/dto/response';
import {
  GetSearchSuggestionsQueryDto,
  GetSocialSuggestionsQueryDto,
  GetTrendingUsersQueryDto,
  GetUserFollowersQueryDto,
} from '@/modules/social/dto/request';
import { RequireAuth } from '@/common/guards/jwt.guard';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { User } from '@/common/decorators/user.decorator';
import { SocialDomainExceptionFilter } from '../filters/social-domain-exception.filter';

@ApiTags('social')
@ApiBearerAuth()
@Controller('social')
@RequireAuth()
@UseFilters(SocialDomainExceptionFilter)
export class SocialController {
  constructor(private readonly socialService: SocialApplicationService) {}

  // User Search
  @Get('search/suggestions')
  @ApiOperation({
    summary: 'Get username search suggestions',
    description:
      'Returns lightweight username suggestions for autocomplete using case-insensitive prefix matching.',
  })
  @ApiOkResponse({
    description: 'Username suggestions returned',
    schema: {
      type: 'array',
      items: { type: 'string', example: 'anh' },
      example: ['anh', 'annguyen', 'andrew'],
    },
  })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  async getSearchSuggestions(@Query() query: GetSearchSuggestionsQueryDto): Promise<string[]> {
    return this.socialService.searchUsernameSuggestions(query.q, query.limit ?? 10);
  }

  @Get('users/search')
  async searchUsers(
    @User() user: JwtPayload,
    @Query('q') query: string,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ): Promise<SearchableUserDto[]> {
    return this.socialService.searchUsers(user, query, limit);
  }

  @Get('suggestions')
  @ApiOperation({
    summary: 'Get social suggestions',
    description:
      'Returns paginated suggested users to connect with, ranked by mutual friends and mutual followers.',
  })
  @ApiOkResponse({
    description: 'Suggested users returned',
    type: SocialSuggestionsResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  async getSuggestions(
    @User() user: JwtPayload,
    @Query() query: GetSocialSuggestionsQueryDto,
  ): Promise<SocialSuggestionsResponseDto> {
    return this.socialService.getSuggestions(user, query.page ?? 1, query.limit ?? 20);
  }

  @Get('feed')
  @ApiOperation({
    summary: 'Get social feed',
    description:
      'Returns a paginated unified social activity feed across supported modules, ordered by newest activity first.',
  })
  @ApiOkResponse({
    description: 'Paginated social feed returned',
    type: SocialFeedResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  async getFeed(
    @User() user: JwtPayload,
    @Query() query: GetUserFollowersQueryDto,
  ): Promise<SocialFeedResponseDto> {
    return this.socialService.getFeed(user, query.page ?? 1, query.limit ?? 20);
  }

  @Get('me/analytics')
  @ApiOperation({
    summary: 'Get my social analytics',
    description:
      'Returns aggregate analytics for the authenticated user, including current social counts and net follower growth over the last 30 days.',
  })
  @ApiOkResponse({
    description: 'Authenticated user social analytics returned',
    type: MySocialAnalyticsResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  async getMySocialAnalytics(@User() user: JwtPayload): Promise<MySocialAnalyticsResponseDto> {
    return this.socialService.getMySocialAnalytics(user);
  }

  @Get('users/trending')
  @ApiOperation({
    summary: 'Get trending users',
    description:
      'Returns trending public users ranked by follower base, recent follower growth, recent friendship growth, and recent social activity.',
  })
  @ApiOkResponse({
    description: 'Trending users returned',
    type: TrendingUsersListResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  async getTrendingUsers(@Query() query: GetTrendingUsersQueryDto): Promise<TrendingUsersListResponseDto> {
    return this.socialService.getTrendingUsers(query.limit ?? 20);
  }

  @Get('users/:userId/activity')
  @ApiOperation({
    summary: 'Get user public activity timeline',
    description:
      'Returns a paginated public activity timeline for the specified user, ordered by newest activity first.',
  })
  @ApiParam({
    name: 'userId',
    description: 'Target user identifier',
    format: 'uuid',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  @ApiOkResponse({
    description: 'Paginated public user activity returned',
    type: UserActivityResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  async getUserActivity(
    @User() user: JwtPayload,
    @Param('userId', new ParseUUIDPipe()) targetUserId: string,
    @Query() query: GetUserFollowersQueryDto,
  ): Promise<UserActivityResponseDto> {
    return this.socialService.getUserActivity(user, targetUserId, query.page ?? 1, query.limit ?? 20);
  }

  @Get('users/:userId/stats')
  @ApiOperation({
    summary: 'Get public social stats for a user',
    description:
      'Returns aggregate public social statistics for the specified user, including friends, followers, and following counts.',
  })
  @ApiParam({
    name: 'userId',
    description: 'Target user identifier',
    format: 'uuid',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  @ApiOkResponse({
    description: 'Public user social stats returned',
    type: UserSocialStatsResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  async getUserSocialStats(
    @Param('userId', new ParseUUIDPipe()) targetUserId: string,
  ): Promise<UserSocialStatsResponseDto> {
    return this.socialService.getUserSocialStats(targetUserId);
  }

  // Friend Leaderboard
  @Get('friends/leaderboard')
  async getFriendLeaderboard(
    @User() user: JwtPayload,
    @Query('period', new DefaultValuePipe('weekly')) period: 'weekly' | 'monthly' | 'all_time',
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ): Promise<FriendLeaderboardDto> {
    return this.socialService.getFriendLeaderboard(user, period, limit);
  }

  // Friend Requests
  @Post('friend-request/:userId')
  async sendFriendRequest(
    @User() user: JwtPayload,
    @Param('userId') addresseeId: string,
  ): Promise<FriendRequestDto> {
    return this.socialService.sendFriendRequest(user, addresseeId);
  }

  @Get('friend-requests/incoming')
  async getPendingRequests(@User() user: JwtPayload): Promise<FriendRequestDto[]> {
    return this.socialService.getPendingRequests(user);
  }

  @Get('friend-requests/outgoing')
  async getSentRequests(@User() user: JwtPayload): Promise<FriendRequestDto[]> {
    return this.socialService.getSentRequests(user);
  }

  @Post('friend-requests/:friendshipId/respond')
  async respondToFriendRequest(
    @User() user: JwtPayload,
    @Param('friendshipId') friendshipId: string,
    @Body() body: { accept: boolean },
  ): Promise<{ message: string }> {
    await this.socialService.respondToFriendRequest(user, friendshipId, body.accept);
    return { message: body.accept ? 'Friend request accepted' : 'Friend request rejected' };
  }

  @Delete('friend-requests/:friendshipId')
  async cancelFriendRequest(
    @User() user: JwtPayload,
    @Param('friendshipId') friendshipId: string,
  ): Promise<{ message: string }> {
    await this.socialService.cancelFriendRequest(user, friendshipId);
    return { message: 'Friend request cancelled' };
  }

  // Friends
  @Get('friends')
  async getFriends(
    @User() user: JwtPayload,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('cursor') cursor?: string,
  ): Promise<{ items: FriendDto[]; hasNextPage: boolean }> {
    return this.socialService.getFriends(user, limit, cursor ?? null);
  }

  @Get('friends/:userId')
  async getFriendsOfUser(
    @User() user: JwtPayload,
    @Param('userId') targetUserId: string,
  ): Promise<{ items: FriendDto[]; hasNextPage: boolean }> {
    const result = await this.socialService.getFriends({ ...user, sub: targetUserId }, 20, null);
    return result;
  }

  @Delete('friends/:userId')
  async removeFriend(
    @User() user: JwtPayload,
    @Param('userId') friendId: string,
  ): Promise<{ message: string }> {
    await this.socialService.removeFriend(user, friendId);
    return { message: 'Friend removed' };
  }

  // Blocking
  @Post('block/:userId')
  async blockUser(
    @User() user: JwtPayload,
    @Param('userId') blockedId: string,
    @Body() body: { reason?: string },
  ): Promise<{ message: string }> {
    await this.socialService.blockUser(user, blockedId, body.reason);
    return { message: 'User blocked' };
  }

  @Delete('block/:userId')
  async unblockUser(
    @User() user: JwtPayload,
    @Param('userId') blockedId: string,
  ): Promise<{ message: string }> {
    await this.socialService.unblockUser(user, blockedId);
    return { message: 'User unblocked' };
  }

  @Get('blocked')
  async getBlockedUsers(@User() user: JwtPayload): Promise<BlockedUserDto[]> {
    return this.socialService.getBlockedUsers(user);
  }

  // Following
  @Post('follow/:userId')
  async followUser(
    @User() user: JwtPayload,
    @Param('userId') followingId: string,
  ): Promise<{ message: string }> {
    await this.socialService.followUser(user, followingId);
    return { message: 'Now following user' };
  }

  @Delete('follow/:userId')
  async unfollowUser(
    @User() user: JwtPayload,
    @Param('userId') followingId: string,
  ): Promise<{ message: string }> {
    await this.socialService.unfollowUser(user, followingId);
    return { message: 'Unfollowed user' };
  }

  @Get('followers')
  async getFollowers(
    @User() user: JwtPayload,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('cursor') cursor?: string,
  ): Promise<{ items: FollowerDto[]; hasNextPage: boolean }> {
    return this.socialService.getFollowers(user, limit, cursor ?? null);
  }

  @Get('users/:userId/followers')
  @ApiOperation({
    summary: 'Get user followers',
    description: 'Returns a paginated list of followers for the specified user, ordered by newest follow first.',
  })
  @ApiParam({
    name: 'userId',
    description: 'Target user identifier',
    format: 'uuid',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  @ApiOkResponse({
    description: 'Paginated followers returned',
    type: UserFollowersResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  async getUserFollowers(
    @User() user: JwtPayload,
    @Param('userId', new ParseUUIDPipe()) targetUserId: string,
    @Query() query: GetUserFollowersQueryDto,
  ): Promise<UserFollowersResponseDto> {
    return this.socialService.getFollowersOfUser(user, targetUserId, query.page ?? 1, query.limit ?? 20);
  }

  @Get('users/:userId/mutual-friends')
  @ApiOperation({
    summary: 'Get mutual friends',
    description:
      'Returns a paginated list of friends shared between the authenticated user and the specified user, ordered alphabetically by username.',
  })
  @ApiParam({
    name: 'userId',
    description: 'Target user identifier',
    format: 'uuid',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  @ApiOkResponse({
    description: 'Paginated mutual friends returned',
    type: MutualFriendsResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  async getMutualFriends(
    @User() user: JwtPayload,
    @Param('userId', new ParseUUIDPipe()) targetUserId: string,
    @Query() query: GetUserFollowersQueryDto,
  ): Promise<MutualFriendsResponseDto> {
    return this.socialService.getMutualFriends(user, targetUserId, query.page ?? 1, query.limit ?? 20);
  }

  @Get('users/:userId/mutual-followers')
  @ApiOperation({
    summary: 'Get mutual followers',
    description:
      'Returns a paginated list of users followed by both the authenticated user and the specified user, ordered alphabetically by username.',
  })
  @ApiParam({
    name: 'userId',
    description: 'Target user identifier',
    format: 'uuid',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  @ApiOkResponse({
    description: 'Paginated mutual followers returned',
    type: MutualFollowersResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  async getMutualFollowers(
    @User() user: JwtPayload,
    @Param('userId', new ParseUUIDPipe()) targetUserId: string,
    @Query() query: GetUserFollowersQueryDto,
  ): Promise<MutualFollowersResponseDto> {
    return this.socialService.getMutualFollowers(user, targetUserId, query.page ?? 1, query.limit ?? 20);
  }

  @Get('users/:userId/following')
  @ApiOperation({
    summary: 'Get user following',
    description:
      'Returns a paginated list of users followed by the specified user, ordered by newest follow first.',
  })
  @ApiParam({
    name: 'userId',
    description: 'Target user identifier',
    format: 'uuid',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  @ApiOkResponse({
    description: 'Paginated following returned',
    type: UserFollowingResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  async getUserFollowing(
    @User() user: JwtPayload,
    @Param('userId', new ParseUUIDPipe()) targetUserId: string,
    @Query() query: GetUserFollowersQueryDto,
  ): Promise<UserFollowingResponseDto> {
    return this.socialService.getFollowingOfUser(user, targetUserId, query.page ?? 1, query.limit ?? 20);
  }

  @Get('following')
  async getFollowing(
    @User() user: JwtPayload,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('cursor') cursor?: string,
  ): Promise<{ items: FollowingDto[]; hasNextPage: boolean }> {
    return this.socialService.getFollowing(user, limit, cursor ?? null);
  }

  // Relationship
  @Get('relationship/:userId')
  async getRelationshipStatus(
    @User() user: JwtPayload,
    @Param('userId') targetId: string,
  ): Promise<RelationshipStatusDto> {
    return this.socialService.getRelationshipStatus(user, targetId);
  }

  @Get('counts')
  async getSocialCounts(@User() user: JwtPayload): Promise<SocialCountsDto> {
    return this.socialService.getSocialCounts(user);
  }
}
