import {
  Controller,
  Get,
  Post,
  Delete,
  All,
  Param,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  Body,
  ParseUUIDPipe,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiOkResponse,
  ApiQuery,
  ApiBody,
  ApiNotFoundResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import { Transactional } from '@/common/interceptors/transactional.interceptor';
import { ApiAuthAction, ApiAuthActionNoContent } from '@/common/swagger/swagger-decorators';
import {
  ApiOkResource,
  ApiCreatedResource,
  ApiOkResourceList,
  ApiOkResourceArray,
} from '@/common/swagger/api-ok';
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
  GetSocialSuggestionsCursorDto,
  GetFeedCursorQueryDto,
  GetFollowCursorQueryDto,
  GetTrendingUsersQueryDto,
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
  @ApiOkResourceList(SocialSuggestionItemDto, 'cursor', {
    description: 'Suggested users returned',
  })
  async getSuggestions(
    @CurrentUser() user: JwtPayload,
    @Query() query: GetSocialSuggestionsCursorDto,
  ) {
    const result = await this.socialService.getSuggestions(
      user,
      query.cursor ?? null,
      query.limit ?? 20,
    );
    return this.presenter.getSuggestions(
      result as unknown as Parameters<typeof this.presenter.getSuggestions>[0],
    );
  }

  @Get('feed')
  @ApiAuthAction()
  @ApiOperation({
    summary: 'Get social feed',
    description:
      "Returns a paginated unified social activity feed from the authenticated user's network, ordered by newest activity first.",
  })
  @ApiOkResourceList(SocialFeedItemDto, 'cursor', {
    description: 'Paginated social feed returned',
  })
  async getFeed(@CurrentUser() user: JwtPayload, @Query() query: GetFeedCursorQueryDto) {
    const result = await this.socialService.getFeed(user, query.cursor ?? null, query.limit ?? 20);
    return this.presenter.getFeed(
      result as unknown as Parameters<typeof this.presenter.getFeed>[0],
    );
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
    const raw = await this.socialService.getMySocialAnalytics(user);
    return this.presenter.getMySocialAnalytics(this.normaliseAnalytics(raw));
  }

  @Get('users/trending')
  @Public()
  @ApiOperation({ summary: 'List trending users' })
  // Phase 7 (api-contract audit): the runtime emits a non-paginated
  // bare array (bounded by `limit`), so the OpenAPI schema must match —
  // `ApiOkResourceArray` is the canonical decorator for non-paginated
  // bare arrays. The endpoint does not implement cursor pagination.
  @ApiOkResourceArray(TrendingUserResponseDto, {
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
      'Returns a paginated public activity timeline for the specified user, ordered by newest activity first. ' +
      "Honours the target user's `showActivity` privacy flag (Phase 3 / F-13): a requester other than the owner " +
      'receives 403 when the flag is `false`. Returns 404 when the target user does not exist.',
  })
  @ApiParam({
    name: 'userId',
    description: 'Target user identifier',
    format: 'uuid',
    example: '660e8400-e29b-71d4-a716-446655440000',
  })
  @ApiOkResourceList(UserActivityItemDto, 'cursor', {
    description: 'Paginated public user activity returned',
  })
  @ApiNotFoundResponse({ description: 'Target user not found' })
  @ApiForbiddenResponse({ description: 'Target user has disabled activity visibility' })
  async getUserActivity(
    @CurrentUser() user: JwtPayload,
    @Param('userId', new ParseUUIDPipe({ version: '7' })) targetUserId: string,
    @Query() query: GetFeedCursorQueryDto,
  ) {
    const result = await this.socialService.getUserActivity(
      user,
      targetUserId,
      query.cursor ?? null,
      query.limit ?? 20,
    );
    return this.presenter.getUserActivity(
      result as unknown as Parameters<typeof this.presenter.getUserActivity>[0],
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
    const raw = await this.socialService.getUserSocialStats(targetUserId);
    return this.presenter.getUserSocialStats(this.normaliseUserStats(raw));
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
    const raw = await this.socialService.getFriendLeaderboard(user, period, limit);
    return this.presenter.getFriendLeaderboard(this.normaliseFriendLeaderboard(raw));
  }

  // ─── Phase 3 (S-17) wire-shape adapters ──────────────────────────────────

  private normaliseAnalytics(
    raw: unknown,
  ): import('@/modules/social/dto/response').MySocialAnalyticsResponseDto {
    const source = raw as {
      friends: number;
      followers: number;
      following: number;
      growth30Days: number;
    };
    return {
      friends: source.friends,
      followers: source.followers,
      following: source.following,
      growth30Days: source.growth30Days,
      staleAt: null,
      isStale: false,
    };
  }

  private normaliseUserStats(
    raw: unknown,
  ): import('@/modules/social/dto/response').UserSocialStatsResponseDto {
    const source = raw as { friends: number; followers: number; following: number };
    return {
      friends: source.friends,
      followers: source.followers,
      following: source.following,
      staleAt: null,
      isStale: false,
    };
  }

  private normaliseFriendLeaderboard(
    raw: unknown,
  ): import('@/modules/social/dto/response').FriendLeaderboardDto {
    const source = raw as {
      period: 'weekly' | 'monthly' | 'all_time';
      entries: Array<{
        rank: number;
        userId: string;
        username: string;
        displayName: string | null;
        avatarUrl: string | null;
        xp: number;
        friendSince: string;
      }>;
      currentUserRank?: number | null | { rank: number; xp: number; totalParticipants: number };
      totalParticipants: number;
    };
    const total = source.totalParticipants;
    let currentUserRank: { rank: number; xp: number; totalParticipants: number } | null = null;
    if (typeof source.currentUserRank === 'number' && source.currentUserRank !== null) {
      currentUserRank = {
        rank: source.currentUserRank,
        xp: 0,
        totalParticipants: total,
      };
    } else if (source.currentUserRank && typeof source.currentUserRank === 'object') {
      currentUserRank = source.currentUserRank;
    }

    return {
      period: source.period,
      entries: source.entries,
      currentUserRank,
      totalParticipants: total,
      staleAt: null,
      isStale: false,
    };
  }

  // ─── Friend Requests ──────────────────────────────────────────────────────
  //
  // All friend-request endpoints use the plural resource noun
  // `friend-requests`. The previous singular form (`POST /friend-request/:userId`)
  // was renamed for consistency with the rest of the surface. A single
  // `@All('friend-request')` handler below preserves the singular path
  // and returns RFC 7807 405 Method Not Allowed so existing SDKs that
  // cached the old URL fail loudly instead of silently misrouting.
  // The stub is intentionally kept forever — see docs/standards/api.md.

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Transactional()
  @Post('friend-requests/:userId')
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

  /**
   * Deprecated singular path. The friend-request resource is always accessed
   * through `/friend-requests` (or `/friend-requests/{friendshipId}/...`).
   * Any HTTP verb that lands here is intentionally rejected with 405 so
   * clients that cached the old URL surface the misroute instead of being
   * silently dropped to a 404.
   *
   * @deprecated Use POST /friend-requests/:userId instead
   */
  @All('friend-request')
  @ApiOperation({
    summary: '[DEPRECATED] Singular friend-request path (always returns 405)',
    description:
      '⚠️ DEPRECATED: This endpoint is deprecated and will be removed in a future version.\n\n' +
      'Use POST /friend-requests/:userId instead.\n\n' +
      'Retained indefinitely for forward-compatibility with SDKs that cached ' +
      'the pre-consolidation path. Every method on this path returns ' +
      '`405 Method Not Allowed`. Migrate callers to `POST /friend-requests/:userId` ' +
      'or the matching plural route.',
  })
  @ApiOkResponse({ description: 'Stub — never returns 200' })
  // 405 is intentionally not in `ApiOkResource` etc.; declare it explicitly.
  // The RuntimeException is caught by `GlobalExceptionFilter` and emitted as
  // an RFC 7807 ProblemDetail with `extensions.code = 'GLOBAL_METHOD_NOT_ALLOWED'`.
  deprecatedFriendRequestPath(): never {
    throw new HttpException(
      {
        statusCode: HttpStatus.METHOD_NOT_ALLOWED,
        error: 'Method Not Allowed',
        message:
          "The plural form '/friend-requests' is canonical. " +
          'This singular path is retained only to emit 405 for cached URLs.',
      },
      HttpStatus.METHOD_NOT_ALLOWED,
    );
  }

  @Get('friend-requests/incoming')
  @ApiAuthAction()
  @ApiOperation({ summary: 'Get incoming friend requests' })
  // Phase 7 (api-contract audit): the runtime emits a non-paginated
  // bare array, so the OpenAPI schema must match — `ApiOkResourceArray`
  // is the canonical decorator for non-paginated bare arrays.
  @ApiOkResourceArray(FriendRequestDto, {
    description: 'Incoming friend requests returned',
  })
  async getPendingRequests(@CurrentUser() user: JwtPayload) {
    return this.presenter.getPendingRequests(await this.socialService.getPendingRequests(user));
  }

  @Get('friend-requests/outgoing')
  @ApiAuthAction()
  @ApiOperation({ summary: 'Get outgoing friend requests' })
  // Phase 7 (api-contract audit): the runtime emits a non-paginated
  // bare array, so the OpenAPI schema must match — `ApiOkResourceArray`
  // is the canonical decorator for non-paginated bare arrays.
  @ApiOkResourceArray(FriendRequestDto, {
    description: 'Outgoing friend requests returned',
  })
  async getSentRequests(@CurrentUser() user: JwtPayload) {
    return this.presenter.getSentRequests(await this.socialService.getSentRequests(user));
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Transactional()
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

  @Transactional()
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

  @Transactional()
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
  @Transactional()
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

  @Transactional()
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
  // Phase 7 (api-contract audit): the runtime emits a non-paginated
  // bare array, so the OpenAPI schema must match — `ApiOkResourceArray`
  // is the canonical decorator for non-paginated bare arrays.
  @ApiOkResourceArray(BlockedUserDto, { description: 'Blocked users returned' })
  async getBlockedUsers(@CurrentUser() user: JwtPayload) {
    return this.presenter.getBlockedUsers(await this.socialService.getBlockedUsers(user));
  }

  // ─── Following ────────────────────────────────────────────────────────────

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Transactional()
  @Post('follow/:userId')
  @ApiOperation({
    summary: 'Follow a user',
    description:
      'Creates a follow relationship with the target user. This operation is idempotent: ' +
      'if the current user already follows the target user, the request succeeds with 204 No Content ' +
      'and no duplicate follow record is created.',
  })
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
  @Transactional()
  @Delete('follow/:userId')
  @ApiOperation({
    summary: 'Unfollow a user',
    description:
      'Removes the follow relationship with the target user. Returns 404 if the current user ' +
      'is not following the target user.',
  })
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
  @ApiOkResourceList(UserFollowerItemDto, 'cursor', {
    description: 'Paginated followers returned',
  })
  async getUserFollowers(
    @CurrentUser() user: JwtPayload,
    @Param('userId', new ParseUUIDPipe({ version: '7' })) targetUserId: string,
    @Query() query: GetFollowCursorQueryDto,
  ) {
    return this.presenter.getFollowersOfUser(
      await this.socialService.getFollowersOfUser(
        user,
        targetUserId,
        query.cursor ?? null,
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
  @ApiOkResourceList(MutualFriendItemDto, 'cursor', {
    description: 'Paginated mutual friends returned',
  })
  async getMutualFriends(
    @CurrentUser() user: JwtPayload,
    @Param('userId', new ParseUUIDPipe({ version: '7' })) targetUserId: string,
    @Query() query: GetFollowCursorQueryDto,
  ) {
    return this.presenter.getMutualFriends(
      await this.socialService.getMutualFriends(
        user,
        targetUserId,
        query.cursor ?? null,
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
  @ApiOkResourceList(MutualFollowerItemDto, 'cursor', {
    description: 'Paginated mutual followers returned',
  })
  async getMutualFollowers(
    @CurrentUser() user: JwtPayload,
    @Param('userId', new ParseUUIDPipe({ version: '7' })) targetUserId: string,
    @Query() query: GetFollowCursorQueryDto,
  ) {
    return this.presenter.getMutualFollowers(
      await this.socialService.getMutualFollowers(
        user,
        targetUserId,
        query.cursor ?? null,
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
  @ApiOkResourceList(UserFollowingItemDto, 'cursor', {
    description: 'Paginated following returned',
  })
  async getUserFollowing(
    @CurrentUser() user: JwtPayload,
    @Param('userId', new ParseUUIDPipe({ version: '7' })) targetUserId: string,
    @Query() query: GetFollowCursorQueryDto,
  ) {
    return this.presenter.getFollowingOfUser(
      await this.socialService.getFollowingOfUser(
        user,
        targetUserId,
        query.cursor ?? null,
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
