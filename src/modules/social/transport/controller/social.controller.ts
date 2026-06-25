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
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import {
  ApiAuth,
  ApiAuthAction,
  ApiAuthActionNoContent,
  ApiPublicRead,
  ApiOk,
} from '@/common/swagger/swagger-decorators';
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
  WrappedUsernameSuggestionsDto,
  WrappedSearchUsersDto,
  WrappedTrendingUsersDto,
  WrappedFriendLeaderboardDto,
  WrappedFriendRequestsDto,
  WrappedMessageDto,
  WrappedFriendsDto,
  WrappedFollowersDto,
  WrappedFollowingDto,
  WrappedUserFollowersDto,
  WrappedUserFollowingDto,
  WrappedMutualFriendsDto,
  WrappedMutualFollowersDto,
  WrappedSocialSuggestionsDto,
  WrappedSocialFeedDto,
  WrappedUserActivityDto,
  WrappedRelationshipStatusDto,
  WrappedSocialCountsDto,
  WrappedUserSocialStatsDto,
  WrappedMySocialAnalyticsDto,
  WrappedBlockedUsersDto,
} from '@/modules/social/dto/response/social-response-docs.dto';
import {
  GetSearchSuggestionsQueryDto,
  GetSocialSuggestionsQueryDto,
  GetTrendingUsersQueryDto,
  GetUserFollowersQueryDto,
} from '@/modules/social/dto/request';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { SocialDomainExceptionFilter } from '../filters/social-domain-exception.filter';
import { CurrentUser } from '@/common/decorators/current-user.decorator';

@ApiTags('social')
@Controller('social')
@UseFilters(SocialDomainExceptionFilter)
export class SocialController {
  constructor(private readonly socialService: SocialApplicationService) {}

  // ─── Search ────────────────────────────────────────────────────────────────

  @Get('search/suggestions')
  @Public()
  @ApiPublicRead({
    description: 'Username suggestions returned',
    type: WrappedUsernameSuggestionsDto,
  })
  async getSearchSuggestions(@Query() query: GetSearchSuggestionsQueryDto): Promise<string[]> {
    const suggestions = await this.socialService.searchUsernameSuggestions(
      query.q,
      query.limit ?? 10,
    );
    return suggestions.map((s) => s.username);
  }

  @Get('users/search')
  @ApiAuth()
  @ApiOperation({ summary: 'Search users by username' })
  @ApiOk({ description: 'Search results returned', type: WrappedSearchUsersDto })
  searchUsers(
    @CurrentUser() user: JwtPayload,
    @Query('q') query: string,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ): SearchableUserDto[] {
    return this.socialService.searchUsers(user, query, limit) as unknown as SearchableUserDto[];
  }

  // ─── Suggestions & Feed ──────────────────────────────────────────────────

  @Get('suggestions')
  @ApiAuth()
  @ApiOperation({
    summary: 'Get social suggestions',
    description:
      'Returns paginated suggested users to connect with, ranked by mutual friends and mutual followers.',
  })
  @ApiOk({ description: 'Suggested users returned', type: WrappedSocialSuggestionsDto })
  async getSuggestions(
    @CurrentUser() user: JwtPayload,
    @Query() query: GetSocialSuggestionsQueryDto,
  ): Promise<SocialSuggestionsResponseDto> {
    return this.socialService.getSuggestions(user, query.page ?? 1, query.limit ?? 20);
  }

  @Get('feed')
  @ApiAuth()
  @ApiOperation({
    summary: 'Get social feed',
    description:
      'Returns a paginated unified social activity feed across supported modules, ordered by newest activity first.',
  })
  @ApiOk({ description: 'Paginated social feed returned', type: WrappedSocialFeedDto })
  async getFeed(
    @CurrentUser() user: JwtPayload,
    @Query() query: GetUserFollowersQueryDto,
  ): Promise<SocialFeedResponseDto> {
    return this.socialService.getFeed(user, query.page ?? 1, query.limit ?? 20);
  }

  @Get('me/analytics')
  @ApiAuth()
  @ApiOperation({
    summary: 'Get my social analytics',
    description:
      'Returns aggregate analytics for the authenticated user, including current social counts and net follower growth over the last 30 days.',
  })
  @ApiOk({
    description: 'Authenticated user social analytics returned',
    type: WrappedMySocialAnalyticsDto,
  })
  async getMySocialAnalytics(
    @CurrentUser() user: JwtPayload,
  ): Promise<MySocialAnalyticsResponseDto> {
    return this.socialService.getMySocialAnalytics(user);
  }

  @Get('users/trending')
  @Public()
  @ApiPublicRead({ description: 'Trending users returned', type: WrappedTrendingUsersDto })
  async getTrendingUsers(
    @Query() query: GetTrendingUsersQueryDto,
  ): Promise<TrendingUsersListResponseDto> {
    return this.socialService.getTrendingUsers(query.limit ?? 20);
  }

  @Get('users/:userId/activity')
  @ApiAuth()
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
  @ApiOk({ description: 'Paginated public user activity returned', type: WrappedUserActivityDto })
  async getUserActivity(
    @CurrentUser() user: JwtPayload,
    @Param('userId', new ParseUUIDPipe()) targetUserId: string,
    @Query() query: GetUserFollowersQueryDto,
  ): Promise<UserActivityResponseDto> {
    return this.socialService.getUserActivity(
      user,
      targetUserId,
      query.page ?? 1,
      query.limit ?? 20,
    );
  }

  @Get('users/:userId/stats')
  @Public()
  @ApiPublicRead({
    description: 'Public user social stats returned',
    type: WrappedUserSocialStatsDto,
  })
  @ApiParam({
    name: 'userId',
    description: 'Target user identifier',
    format: 'uuid',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  async getUserSocialStats(
    @Param('userId', new ParseUUIDPipe()) targetUserId: string,
  ): Promise<UserSocialStatsResponseDto> {
    return this.socialService.getUserSocialStats(targetUserId);
  }

  // ─── Friend Leaderboard ─────────────────────────────────────────────────

  @Get('friends/leaderboard')
  @ApiAuth()
  @ApiOperation({ summary: 'Get friend leaderboard' })
  @ApiOk({ description: 'Friend leaderboard returned', type: WrappedFriendLeaderboardDto })
  async getFriendLeaderboard(
    @CurrentUser() user: JwtPayload,
    @Query('period', new DefaultValuePipe('weekly')) period: 'weekly' | 'monthly' | 'all_time',
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ): Promise<FriendLeaderboardDto> {
    return this.socialService.getFriendLeaderboard(user, period, limit);
  }

  // ─── Friend Requests ──────────────────────────────────────────────────────

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('friend-request/:userId')
  @ApiAuthAction({ description: 'Friend request sent', type: WrappedFriendRequestsDto })
  async sendFriendRequest(
    @CurrentUser() user: JwtPayload,
    @Param('userId', new ParseUUIDPipe()) addresseeId: string,
  ): Promise<FriendRequestDto> {
    return this.socialService.sendFriendRequest(user, addresseeId);
  }

  @Get('friend-requests/incoming')
  @ApiAuth()
  @ApiOperation({ summary: 'Get incoming friend requests' })
  @ApiOk({ description: 'Incoming friend requests returned', type: WrappedFriendRequestsDto })
  getPendingRequests(@CurrentUser() user: JwtPayload): FriendRequestDto[] {
    return this.socialService.getPendingRequests(user) as unknown as FriendRequestDto[];
  }

  @Get('friend-requests/outgoing')
  @ApiAuth()
  @ApiOperation({ summary: 'Get outgoing friend requests' })
  @ApiOk({ description: 'Outgoing friend requests returned', type: WrappedFriendRequestsDto })
  getSentRequests(@CurrentUser() user: JwtPayload): FriendRequestDto[] {
    return this.socialService.getSentRequests(user) as unknown as FriendRequestDto[];
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('friend-requests/:friendshipId/respond')
  @ApiAuthActionNoContent('Friend request responded to')
  async respondToFriendRequest(
    @CurrentUser() user: JwtPayload,
    @Param('friendshipId', new ParseUUIDPipe()) friendshipId: string,
    @Body() body: { accept: boolean },
  ): Promise<void> {
    await this.socialService.respondToFriendRequest(user, friendshipId, body.accept);
  }

  @Delete('friend-requests/:friendshipId')
  @ApiAuthActionNoContent('Friend request cancelled')
  async cancelFriendRequest(
    @CurrentUser() user: JwtPayload,
    @Param('friendshipId', new ParseUUIDPipe()) friendshipId: string,
  ): Promise<void> {
    await this.socialService.cancelFriendRequest(user, friendshipId);
  }

  // ─── Friends ─────────────────────────────────────────────────────────────

  @Get('friends')
  @ApiAuth()
  @ApiOperation({ summary: 'Get my friends' })
  @ApiOk({ description: 'Friends returned', type: WrappedFriendsDto })
  getFriends(
    @CurrentUser() user: JwtPayload,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('cursor') cursor?: string,
  ): { items: FriendDto[]; hasNextPage: boolean } {
    return this.socialService.getFriends(user, limit, cursor ?? null) as unknown as {
      items: FriendDto[];
      hasNextPage: boolean;
    };
  }

  @Get('friends/:userId')
  @ApiAuth()
  @ApiOperation({ summary: "Get another user's friends" })
  @ApiOk({ description: 'Friends returned', type: WrappedFriendsDto })
  @ApiParam({
    name: 'userId',
    description: 'Target user identifier',
    format: 'uuid',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  getFriendsOfUser(
    @CurrentUser() user: JwtPayload,
    @Param('userId', new ParseUUIDPipe()) targetUserId: string,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('cursor') cursor?: string,
  ): { items: FriendDto[]; hasNextPage: boolean } {
    return this.socialService.getFriendsOfUser(
      user.sub,
      targetUserId,
      limit,
      cursor ?? null,
    ) as unknown as { items: FriendDto[]; hasNextPage: boolean };
  }

  @Delete('friends/:userId')
  @ApiAuthActionNoContent('Friend removed')
  @ApiParam({
    name: 'userId',
    description: 'Friend user identifier',
    format: 'uuid',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  async removeFriend(
    @CurrentUser() user: JwtPayload,
    @Param('userId', new ParseUUIDPipe()) friendId: string,
  ): Promise<void> {
    await this.socialService.removeFriend(user, friendId);
  }

  // ─── Blocking ────────────────────────────────────────────────────────────

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('block/:userId')
  @ApiAuthAction({ description: 'User blocked', type: WrappedMessageDto })
  @ApiParam({
    name: 'userId',
    description: 'User to block',
    format: 'uuid',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  async blockUser(
    @CurrentUser() user: JwtPayload,
    @Param('userId', new ParseUUIDPipe()) blockedId: string,
    @Body() body: { reason?: string },
  ): Promise<{ message: string }> {
    await this.socialService.blockUser(user, blockedId, body.reason);
    return { message: 'User blocked' };
  }

  @Delete('block/:userId')
  @ApiAuthActionNoContent('User unblocked')
  @ApiParam({
    name: 'userId',
    description: 'User to unblock',
    format: 'uuid',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  async unblockUser(
    @CurrentUser() user: JwtPayload,
    @Param('userId', new ParseUUIDPipe()) blockedId: string,
  ): Promise<void> {
    await this.socialService.unblockUser(user, blockedId);
  }

  @Get('blocked')
  @ApiAuth()
  @ApiOperation({ summary: 'Get blocked users' })
  @ApiOk({ description: 'Blocked users returned', type: WrappedBlockedUsersDto })
  getBlockedUsers(@CurrentUser() user: JwtPayload): BlockedUserDto[] {
    return this.socialService.getBlockedUsers(user) as unknown as BlockedUserDto[];
  }

  // ─── Following ────────────────────────────────────────────────────────────

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('follow/:userId')
  @ApiAuthActionNoContent('Now following user')
  @ApiParam({
    name: 'userId',
    description: 'User to follow',
    format: 'uuid',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  async followUser(
    @CurrentUser() user: JwtPayload,
    @Param('userId', new ParseUUIDPipe()) followingId: string,
  ): Promise<void> {
    await this.socialService.followUser(user, followingId);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Delete('follow/:userId')
  @ApiAuthActionNoContent('Unfollowed user')
  @ApiParam({
    name: 'userId',
    description: 'User to unfollow',
    format: 'uuid',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  async unfollowUser(
    @CurrentUser() user: JwtPayload,
    @Param('userId', new ParseUUIDPipe()) followingId: string,
  ): Promise<void> {
    await this.socialService.unfollowUser(user, followingId);
  }

  @Get('followers')
  @ApiAuth()
  @ApiOperation({ summary: 'Get my followers' })
  @ApiOk({ description: 'Followers returned', type: WrappedFollowersDto })
  getFollowers(
    @CurrentUser() user: JwtPayload,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('cursor') cursor?: string,
  ): { items: FollowerDto[]; hasNextPage: boolean } {
    return this.socialService.getFollowers(user, limit, cursor ?? null) as unknown as {
      items: FollowerDto[];
      hasNextPage: boolean;
    };
  }

  @Get('users/:userId/followers')
  @ApiAuth()
  @ApiOperation({
    summary: 'Get user followers',
    description:
      'Returns a paginated list of followers for the specified user, ordered by newest follow first.',
  })
  @ApiParam({
    name: 'userId',
    description: 'Target user identifier',
    format: 'uuid',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  @ApiOk({ description: 'Paginated followers returned', type: WrappedUserFollowersDto })
  async getUserFollowers(
    @CurrentUser() user: JwtPayload,
    @Param('userId', new ParseUUIDPipe()) targetUserId: string,
    @Query() query: GetUserFollowersQueryDto,
  ): Promise<UserFollowersResponseDto> {
    return this.socialService.getFollowersOfUser(
      user,
      targetUserId,
      query.page ?? 1,
      query.limit ?? 20,
    );
  }

  @Get('users/:userId/mutual-friends')
  @ApiAuth()
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
  @ApiOk({ description: 'Paginated mutual friends returned', type: WrappedMutualFriendsDto })
  async getMutualFriends(
    @CurrentUser() user: JwtPayload,
    @Param('userId', new ParseUUIDPipe()) targetUserId: string,
    @Query() query: GetUserFollowersQueryDto,
  ): Promise<MutualFriendsResponseDto> {
    return this.socialService.getMutualFriends(
      user,
      targetUserId,
      query.page ?? 1,
      query.limit ?? 20,
    );
  }

  @Get('users/:userId/mutual-followers')
  @ApiAuth()
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
  @ApiOk({ description: 'Paginated mutual followers returned', type: WrappedMutualFollowersDto })
  async getMutualFollowers(
    @CurrentUser() user: JwtPayload,
    @Param('userId', new ParseUUIDPipe()) targetUserId: string,
    @Query() query: GetUserFollowersQueryDto,
  ): Promise<MutualFollowersResponseDto> {
    return this.socialService.getMutualFollowers(
      user,
      targetUserId,
      query.page ?? 1,
      query.limit ?? 20,
    );
  }

  @Get('users/:userId/following')
  @ApiAuth()
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
  @ApiOk({ description: 'Paginated following returned', type: WrappedUserFollowingDto })
  async getUserFollowing(
    @CurrentUser() user: JwtPayload,
    @Param('userId', new ParseUUIDPipe()) targetUserId: string,
    @Query() query: GetUserFollowersQueryDto,
  ): Promise<UserFollowingResponseDto> {
    return this.socialService.getFollowingOfUser(
      user,
      targetUserId,
      query.page ?? 1,
      query.limit ?? 20,
    );
  }

  @Get('following')
  @ApiAuth()
  @ApiOperation({ summary: 'Get accounts I follow' })
  @ApiOk({ description: 'Following returned', type: WrappedFollowingDto })
  getFollowing(
    @CurrentUser() user: JwtPayload,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('cursor') cursor?: string,
  ): { items: FollowingDto[]; hasNextPage: boolean } {
    return this.socialService.getFollowing(user, limit, cursor ?? null) as unknown as {
      items: FollowingDto[];
      hasNextPage: boolean;
    };
  }

  // ─── Relationship ───────────────────────────────────────────────────────

  @Get('relationship/:userId')
  @ApiAuth()
  @ApiOperation({ summary: 'Get relationship status with a user' })
  @ApiOk({ description: 'Relationship status returned', type: WrappedRelationshipStatusDto })
  @ApiParam({
    name: 'userId',
    description: 'Target user identifier',
    format: 'uuid',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  async getRelationshipStatus(
    @CurrentUser() user: JwtPayload,
    @Param('userId', new ParseUUIDPipe()) targetId: string,
  ): Promise<RelationshipStatusDto> {
    return this.socialService.getRelationshipStatus(user, targetId);
  }

  @Get('counts')
  @ApiAuth()
  @ApiOperation({ summary: 'Get social counts for the authenticated user' })
  @ApiOk({ description: 'Social counts returned', type: WrappedSocialCountsDto })
  async getSocialCounts(@CurrentUser() user: JwtPayload): Promise<SocialCountsDto> {
    return this.socialService.getSocialCounts(user);
  }
}
