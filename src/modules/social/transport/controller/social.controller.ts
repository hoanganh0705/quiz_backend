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
  ParseUUIDPipe,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiParam, ApiOkResponse, ApiQuery, ApiBody } from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import { ApiAuthAction, ApiAuthActionNoContent } from '@/common/swagger/swagger-decorators';
import { ApiOkResource, ApiCreatedResource, ApiOkResourceList } from '@/common/swagger/api-ok';
import { SocialApplicationService } from '@/modules/social/application/social-application.service';
import { SocialPresenter } from '../presenters/social.presenter';
import {
  FriendRequestDto,
  FriendDto,
  SocialCountsDto,
  RelationshipStatusDto,
  BlockedUserDto,
  SearchableUserDto,
  FriendLeaderboardDto,
  UserFollowerItemDto,
  UserFollowingItemDto,
  SocialSuggestionItemDto,
  MutualFriendItemDto,
  MutualFollowerItemDto,
  SocialFeedItemDto,
  UserActivityItemDto,
  UserSocialStatsResponseDto,
  MySocialAnalyticsResponseDto,
  TrendingUserResponseDto,
  MessageResponseDto,
} from '@/modules/social/dto/response';
import {
  GetSearchSuggestionsQueryDto,
  GetSocialSuggestionsQueryDto,
  GetTrendingUsersQueryDto,
  GetUserFollowersQueryDto,
  RespondFriendRequestDto,
  BlockUserDto,
} from '@/modules/social/dto/request';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';

// All error responses (401 / 400 / 403 / 404 / 409 / 500) are covered by
// the `ApiAuthAction` / `ApiAuthActionNoContent` decorators below. After
// Phase 2 the global exception filter emits RFC 7807 `ProblemDetailDto`
// for every social-domain error; the per-module filter has been
// removed.

@ApiTags('social')
@Controller('social')
export class SocialController {
  constructor(
    private readonly socialService: SocialApplicationService,
    private readonly presenter: SocialPresenter,
  ) {}

  // ─── Search ────────────────────────────────────────────────────────────────

  @Get('search/suggestions')
  @Public()
  @ApiOperation({ summary: 'Get username search suggestions' })
  @ApiOkResponse({
    description: 'Username suggestions returned',
    schema: {
      allOf: [
        { $ref: '#/components/schemas/WrappedDto' },
        {
          properties: {
            data: {
              type: 'array',
              items: { type: 'string' },
              example: ['anh', 'annguyen', 'andrew'],
            },
          },
        },
      ],
    },
  })
  async getSearchSuggestions(@Query() query: GetSearchSuggestionsQueryDto) {
    const suggestions = await this.socialService.searchUsernameSuggestions(
      query.q,
      query.limit ?? 10,
    );
    return this.presenter.searchUsernameSuggestions(suggestions);
  }

  @Get('users/search')
  @ApiAuthAction()
  @ApiOperation({ summary: 'Search users by username' })
  @ApiOkResourceList(SearchableUserDto, 'cursor', { description: 'Search results returned' })
  @ApiQuery({ name: 'q', description: 'Search query', schema: { type: 'string' } })
  @ApiQuery({
    name: 'limit',
    description: 'Maximum number of results',
    required: false,
    schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
  })
  searchUsers(
    @CurrentUser() user: JwtPayload,
    @Query('q') query: string,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.socialService
      .searchUsers(user, query, limit)
      .then((result) => this.presenter.searchUsers(result));
  }

  // ─── Suggestions & Feed ──────────────────────────────────────────────────

  @Get('suggestions')
  @ApiAuthAction()
  @ApiOperation({
    summary: 'Get social suggestions',
    description:
      'Returns paginated suggested users to connect with, ranked by mutual friends and mutual followers.',
  })
  @ApiOkResourceList(SocialSuggestionItemDto, 'offset', {
    description: 'Suggested users returned',
  })
  async getSuggestions(
    @CurrentUser() user: JwtPayload,
    @Query() query: GetSocialSuggestionsQueryDto,
  ) {
    const result = await this.socialService.getSuggestions(
      user,
      query.page ?? 1,
      query.limit ?? 20,
    );
    return this.presenter.getSuggestions(result);
  }

  @Get('feed')
  @ApiAuthAction()
  @ApiOperation({
    summary: 'Get social feed',
    description:
      'Returns a paginated unified social activity feed across supported modules, ordered by newest activity first.',
  })
  @ApiOkResourceList(SocialFeedItemDto, 'offset', {
    description: 'Paginated social feed returned',
  })
  async getFeed(@CurrentUser() user: JwtPayload, @Query() query: GetUserFollowersQueryDto) {
    const result = await this.socialService.getFeed(user, query.page ?? 1, query.limit ?? 20);
    return this.presenter.getFeed(result);
  }

  @Get('me/analytics')
  @ApiAuthAction()
  @ApiOperation({
    summary: 'Get my social analytics',
    description:
      'Returns aggregate analytics for the authenticated user, including current social counts and net follower growth over the last 30 days.',
  })
  @ApiOkResource(MySocialAnalyticsResponseDto, {
    description: 'Authenticated user social analytics returned',
  })
  async getMySocialAnalytics(@CurrentUser() user: JwtPayload) {
    return this.presenter.getMySocialAnalytics(await this.socialService.getMySocialAnalytics(user));
  }

  @Get('users/trending')
  @Public()
  @ApiOperation({ summary: 'List trending users' })
  @ApiOkResourceList(TrendingUserResponseDto, 'cursor', {
    description: 'Trending users returned',
  })
  async getTrendingUsers(@Query() query: GetTrendingUsersQueryDto) {
    return this.presenter.getTrendingUsers(
      await this.socialService.getTrendingUsers(query.limit ?? 20),
    );
  }

  @Get('users/:userId/activity')
  @ApiAuthAction()
  @ApiOperation({
    summary: 'Get user public activity timeline',
    description:
      'Returns a paginated public activity timeline for the specified user, ordered by newest activity first.',
  })
  @ApiParam({
    name: 'userId',
    description: 'Target user identifier',
    format: 'uuid',
    example: '660e8400-e29b-71d4-a716-446655440000',
  })
  @ApiOkResourceList(UserActivityItemDto, 'offset', {
    description: 'Paginated public user activity returned',
  })
  async getUserActivity(
    @CurrentUser() user: JwtPayload,
    @Param('userId', new ParseUUIDPipe({ version: '7' })) targetUserId: string,
    @Query() query: GetUserFollowersQueryDto,
  ) {
    return this.presenter.getUserActivity(
      await this.socialService.getUserActivity(
        user,
        targetUserId,
        query.page ?? 1,
        query.limit ?? 20,
      ),
    );
  }

  @Get('users/:userId/stats')
  @Public()
  @ApiOperation({ summary: "Get a user's public social statistics" })
  @ApiOkResource(UserSocialStatsResponseDto, {
    description: 'Public user social stats returned',
  })
  @ApiParam({
    name: 'userId',
    description: 'Target user identifier',
    format: 'uuid',
    example: '660e8400-e29b-71d4-a716-446655440000',
  })
  async getUserSocialStats(
    @Param('userId', new ParseUUIDPipe({ version: '7' })) targetUserId: string,
  ) {
    return this.presenter.getUserSocialStats(
      await this.socialService.getUserSocialStats(targetUserId),
    );
  }

  // ─── Friend Leaderboard ─────────────────────────────────────────────────

  @Get('friends/leaderboard')
  @ApiAuthAction()
  @ApiOperation({ summary: 'Get friend leaderboard' })
  @ApiOkResource(FriendLeaderboardDto, { description: 'Friend leaderboard returned' })
  async getFriendLeaderboard(
    @CurrentUser() user: JwtPayload,
    @Query('period', new DefaultValuePipe('weekly')) period: 'weekly' | 'monthly' | 'all_time',
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.presenter.getFriendLeaderboard(
      await this.socialService.getFriendLeaderboard(user, period, limit),
    );
  }

  // ─── Friend Requests ──────────────────────────────────────────────────────

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('friend-request/:userId')
  @ApiOperation({ summary: 'Send a friend request' })
  @ApiAuthAction()
  @ApiCreatedResource(FriendRequestDto, { description: 'Friend request sent' })
  async sendFriendRequest(
    @CurrentUser() user: JwtPayload,
    @Param('userId', new ParseUUIDPipe({ version: '7' })) addresseeId: string,
  ) {
    return this.presenter.sendFriendRequest(
      await this.socialService.sendFriendRequest(user, addresseeId),
    );
  }

  @Get('friend-requests/incoming')
  @ApiAuthAction()
  @ApiOperation({ summary: 'Get incoming friend requests' })
  @ApiOkResource(FriendRequestDto, {
    description: 'Incoming friend requests returned',
  })
  async getPendingRequests(@CurrentUser() user: JwtPayload) {
    return this.presenter.getPendingRequests(await this.socialService.getPendingRequests(user));
  }

  @Get('friend-requests/outgoing')
  @ApiAuthAction()
  @ApiOperation({ summary: 'Get outgoing friend requests' })
  @ApiOkResource(FriendRequestDto, {
    description: 'Outgoing friend requests returned',
  })
  async getSentRequests(@CurrentUser() user: JwtPayload) {
    return this.presenter.getSentRequests(await this.socialService.getSentRequests(user));
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('friend-requests/:friendshipId/respond')
  @ApiOperation({ summary: 'Accept or decline a friend request' })
  @ApiAuthActionNoContent('Friend request responded to')
  @ApiBody({ type: RespondFriendRequestDto })
  async respondToFriendRequest(
    @CurrentUser() user: JwtPayload,
    @Param('friendshipId', new ParseUUIDPipe({ version: '7' })) friendshipId: string,
    @Body() dto: RespondFriendRequestDto,
  ): Promise<void> {
    await this.socialService.respondToFriendRequest(user, friendshipId, dto.accept);
  }

  @Delete('friend-requests/:friendshipId')
  @ApiOperation({ summary: 'Cancel a sent friend request' })
  @ApiAuthActionNoContent('Friend request cancelled')
  async cancelFriendRequest(
    @CurrentUser() user: JwtPayload,
    @Param('friendshipId', new ParseUUIDPipe({ version: '7' })) friendshipId: string,
  ): Promise<void> {
    await this.socialService.cancelFriendRequest(user, friendshipId);
  }

  // ─── Friends ─────────────────────────────────────────────────────────────

  @Get('friends/:userId')
  @ApiAuthAction()
  @ApiOperation({ summary: "Get another user's friends" })
  @ApiOkResourceList(FriendDto, 'cursor', { description: 'Friends returned' })
  @ApiParam({
    name: 'userId',
    description: 'Target user identifier',
    format: 'uuid',
    example: '660e8400-e29b-71d4-a716-446655440000',
  })
  async getFriendsOfUser(
    @CurrentUser() user: JwtPayload,
    @Param('userId', new ParseUUIDPipe({ version: '7' })) targetUserId: string,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('cursor') cursor?: string,
  ) {
    return this.presenter.getFriendsOfUser(
      await this.socialService.getFriendsOfUser(user.sub, targetUserId, limit, cursor ?? null),
    );
  }

  @Delete('friends/:userId')
  @ApiOperation({ summary: 'Remove a friend' })
  @ApiAuthActionNoContent('Friend removed')
  @ApiParam({
    name: 'userId',
    description: 'Friend user identifier',
    format: 'uuid',
    example: '660e8400-e29b-71d4-a716-446655440000',
  })
  async removeFriend(
    @CurrentUser() user: JwtPayload,
    @Param('userId', new ParseUUIDPipe({ version: '7' })) friendId: string,
  ): Promise<void> {
    await this.socialService.removeFriend(user, friendId);
  }

  // ─── Blocking ────────────────────────────────────────────────────────────

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('block/:userId')
  @ApiOperation({ summary: 'Block a user' })
  @ApiAuthActionNoContent('User blocked')
  @ApiCreatedResource(MessageResponseDto, { description: 'User blocked' })
  @ApiParam({
    name: 'userId',
    description: 'User to block',
    format: 'uuid',
    example: '660e8400-e29b-71d4-a716-446655440000',
  })
  @ApiBody({ type: BlockUserDto, description: 'Optional reason for blocking' })
  async blockUser(
    @CurrentUser() user: JwtPayload,
    @Param('userId', new ParseUUIDPipe({ version: '7' })) blockedId: string,
    @Body() dto: BlockUserDto,
  ) {
    await this.socialService.blockUser(user, blockedId, dto.reason);
    return this.presenter.blockUser({ message: 'User blocked' });
  }

  @Delete('block/:userId')
  @ApiOperation({ summary: 'Unblock a user' })
  @ApiAuthActionNoContent('User unblocked')
  @ApiParam({
    name: 'userId',
    description: 'User to unblock',
    format: 'uuid',
    example: '660e8400-e29b-71d4-a716-446655440000',
  })
  async unblockUser(
    @CurrentUser() user: JwtPayload,
    @Param('userId', new ParseUUIDPipe({ version: '7' })) blockedId: string,
  ): Promise<void> {
    await this.socialService.unblockUser(user, blockedId);
  }

  @Get('blocked')
  @ApiAuthAction()
  @ApiOperation({ summary: 'Get blocked users' })
  @ApiOkResourceList(BlockedUserDto, 'cursor', { description: 'Blocked users returned' })
  async getBlockedUsers(@CurrentUser() user: JwtPayload) {
    return this.presenter.getBlockedUsers(await this.socialService.getBlockedUsers(user));
  }

  // ─── Following ────────────────────────────────────────────────────────────

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('follow/:userId')
  @ApiOperation({ summary: 'Follow a user' })
  @ApiAuthActionNoContent('Now following user')
  @ApiParam({
    name: 'userId',
    description: 'User to follow',
    format: 'uuid',
    example: '660e8400-e29b-71d4-a716-446655440000',
  })
  async followUser(
    @CurrentUser() user: JwtPayload,
    @Param('userId', new ParseUUIDPipe({ version: '7' })) followingId: string,
  ): Promise<void> {
    await this.socialService.followUser(user, followingId);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Delete('follow/:userId')
  @ApiOperation({ summary: 'Unfollow a user' })
  @ApiAuthActionNoContent('Unfollowed user')
  @ApiParam({
    name: 'userId',
    description: 'User to unfollow',
    format: 'uuid',
    example: '660e8400-e29b-71d4-a716-446655440000',
  })
  async unfollowUser(
    @CurrentUser() user: JwtPayload,
    @Param('userId', new ParseUUIDPipe({ version: '7' })) followingId: string,
  ): Promise<void> {
    await this.socialService.unfollowUser(user, followingId);
  }

  @Get('users/:userId/followers')
  @ApiAuthAction()
  @ApiOperation({
    summary: 'Get user followers',
    description:
      'Returns a paginated list of followers for the specified user, ordered by newest follow first.',
  })
  @ApiParam({
    name: 'userId',
    description: 'Target user identifier',
    format: 'uuid',
    example: '660e8400-e29b-71d4-a716-446655440000',
  })
  @ApiOkResourceList(UserFollowerItemDto, 'offset', {
    description: 'Paginated followers returned',
  })
  async getUserFollowers(
    @CurrentUser() user: JwtPayload,
    @Param('userId', new ParseUUIDPipe({ version: '7' })) targetUserId: string,
    @Query() query: GetUserFollowersQueryDto,
  ) {
    return this.presenter.getFollowersOfUser(
      await this.socialService.getFollowersOfUser(
        user,
        targetUserId,
        query.page ?? 1,
        query.limit ?? 20,
      ),
    );
  }

  @Get('users/:userId/mutual-friends')
  @ApiAuthAction()
  @ApiOperation({
    summary: 'Get mutual friends',
    description:
      'Returns a paginated list of friends shared between the authenticated user and the specified user, ordered alphabetically by username.',
  })
  @ApiParam({
    name: 'userId',
    description: 'Target user identifier',
    format: 'uuid',
    example: '660e8400-e29b-71d4-a716-446655440000',
  })
  @ApiOkResourceList(MutualFriendItemDto, 'offset', {
    description: 'Paginated mutual friends returned',
  })
  async getMutualFriends(
    @CurrentUser() user: JwtPayload,
    @Param('userId', new ParseUUIDPipe({ version: '7' })) targetUserId: string,
    @Query() query: GetUserFollowersQueryDto,
  ) {
    return this.presenter.getMutualFriends(
      await this.socialService.getMutualFriends(
        user,
        targetUserId,
        query.page ?? 1,
        query.limit ?? 20,
      ),
    );
  }

  @Get('users/:userId/mutual-followers')
  @ApiAuthAction()
  @ApiOperation({
    summary: 'Get mutual followers',
    description:
      'Returns a paginated list of users followed by both the authenticated user and the specified user, ordered alphabetically by username.',
  })
  @ApiParam({
    name: 'userId',
    description: 'Target user identifier',
    format: 'uuid',
    example: '660e8400-e29b-71d4-a716-446655440000',
  })
  @ApiOkResourceList(MutualFollowerItemDto, 'offset', {
    description: 'Paginated mutual followers returned',
  })
  async getMutualFollowers(
    @CurrentUser() user: JwtPayload,
    @Param('userId', new ParseUUIDPipe({ version: '7' })) targetUserId: string,
    @Query() query: GetUserFollowersQueryDto,
  ) {
    return this.presenter.getMutualFollowers(
      await this.socialService.getMutualFollowers(
        user,
        targetUserId,
        query.page ?? 1,
        query.limit ?? 20,
      ),
    );
  }

  @Get('users/:userId/following')
  @ApiAuthAction()
  @ApiOperation({
    summary: 'Get user following',
    description:
      'Returns a paginated list of users followed by the specified user, ordered by newest follow first.',
  })
  @ApiParam({
    name: 'userId',
    description: 'Target user identifier',
    format: 'uuid',
    example: '660e8400-e29b-71d4-a716-446655440000',
  })
  @ApiOkResourceList(UserFollowingItemDto, 'offset', {
    description: 'Paginated following returned',
  })
  async getUserFollowing(
    @CurrentUser() user: JwtPayload,
    @Param('userId', new ParseUUIDPipe({ version: '7' })) targetUserId: string,
    @Query() query: GetUserFollowersQueryDto,
  ) {
    return this.presenter.getFollowingOfUser(
      await this.socialService.getFollowingOfUser(
        user,
        targetUserId,
        query.page ?? 1,
        query.limit ?? 20,
      ),
    );
  }

  // ─── Relationship ───────────────────────────────────────────────────────

  @Get('relationship/:userId')
  @ApiAuthAction()
  @ApiOperation({ summary: 'Get relationship status with a user' })
  @ApiOkResource(RelationshipStatusDto, { description: 'Relationship status returned' })
  @ApiParam({
    name: 'userId',
    description: 'Target user identifier',
    format: 'uuid',
    example: '660e8400-e29b-71d4-a716-446655440000',
  })
  async getRelationshipStatus(
    @CurrentUser() user: JwtPayload,
    @Param('userId', new ParseUUIDPipe({ version: '7' })) targetId: string,
  ) {
    return this.presenter.getRelationshipStatus(
      await this.socialService.getRelationshipStatus(user, targetId),
    );
  }

  @Get('counts')
  @ApiAuthAction()
  @ApiOperation({ summary: 'Get social counts for the authenticated user' })
  @ApiOkResource(SocialCountsDto, { description: 'Social counts returned' })
  async getSocialCounts(@CurrentUser() user: JwtPayload) {
    return this.presenter.getSocialCounts(await this.socialService.getSocialCounts(user));
  }
}
