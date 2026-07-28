import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { ApiAuth } from '@/common/swagger/swagger-decorators';
import { RecommendedQuizzesQueryDto } from '@/modules/quiz/dto/request/recommended-quizzes-query.dto';
import { ListQuizzesQueryDto } from '@/modules/quiz/dto/request/list-quizzes-query.dto';
import { GetMyTournamentsQueryDto } from '../../dto/request/get-my-tournaments-query.dto';
import { GetMyTournamentHistoryQueryDto } from '../../dto/request/get-my-tournament-history-query.dto';
import { ListUserActivityQueryDto } from '../../dto/request/list-user-activity-query.dto';
import { ListUserBadgesQueryDto } from '../../dto/request/list-user-badges-query.dto';
import { UpdateMeDto } from '../../dto/request/update-me.dto';
import { UpdateMeSettingsDto } from '../../dto/request/update-me-settings.dto';
import { UserApplicationService } from '../../application/user.application.service';
import { UserPresenter } from '../presenters/user.presenter';
import { QUIZ_LISTING_PORT, type QuizListingPort } from '@/modules/quiz/domain/analytics';
import { USER_DOMAIN_SERVICE, type UserDomainService } from '../../domain/user.service';
import {
  ApiBadRequestAndInternal,
  ApiCreatorQuizAnalyticsResponse,
  ApiInternalError,
  ApiNotFoundBadRequestForbiddenInternal,
  ApiNotFoundBadRequestInternal,
  ApiNotFoundForbiddenInternal,
  ApiNotFoundAndInternal,
  ApiPublicTournamentHistoryResponse,
  ApiPublicTournamentProfileResponse,
  ApiRecommendedQuizzesResponse,
  ApiUserActivityResponse,
  ApiUserAnalyticsResponse,
  ApiUserBadgesResponse,
  ApiUserIdParam,
  ApiUserMeResponse,
  ApiUserMeUpdatedResponse,
  ApiUserQuizListResponse,
  ApiUserRankingResponse,
  ApiUserSettingsUpdatedResponse,
  ApiMyTournamentsResponse,
  ApiMyTournamentHistoryResponse,
  ApiMyTournamentAnalyticsResponse,
} from '../swagger/user-swagger-decorators';

@ApiTags('users')
@Controller('users')
export class UserController {
  constructor(
    private readonly userApplicationService: UserApplicationService,
    private readonly presenter: UserPresenter,
    @Inject(QUIZ_LISTING_PORT)
    private readonly quizListing: QuizListingPort,
    @Inject(USER_DOMAIN_SERVICE)
    private readonly userDomainService: UserDomainService,
  ) {}

  @Get('me/recommended-quizzes')
  @ApiAuth()
  @ApiOperation({
    summary: 'Get my recommended quizzes',
    description:
      'Returns quizzes recommended for the authenticated user based on their activity, preferences, and following history.',
  })
  @ApiRecommendedQuizzesResponse()
  @ApiInternalError()
  async getRecommendedQuizzes(
    @CurrentUser('sub') userId: string,
    @Query() query: RecommendedQuizzesQueryDto,
  ) {
    const result = await this.quizListing.getRecommendedQuizzes(userId, query);
    return this.presenter.getRecommendedQuizzes(result);
  }

  @Get('me')
  @ApiAuth()
  @ApiOperation({
    summary: 'Get my profile',
    description:
      "Returns the authenticated user's full profile. " +
      'For the slim identity payload (userId, username, email, role, isVerified) used to bootstrap ' +
      'the auth state on the client, use `GET /api/v1/auth/me` instead. ' +
      'The two endpoints are complementary, not interchangeable.',
  })
  @ApiUserMeResponse()
  @ApiInternalError()
  async me(@CurrentUser('sub') userId: string) {
    const result = await this.userApplicationService.getMe(userId);
    return this.presenter.getMe(result);
  }

  @Get('me/badges')
  @ApiAuth()
  @ApiOperation({
    summary: 'List my earned badges',
    description: 'Returns a cursor-paginated list of badges earned by the authenticated user.',
  })
  @ApiUserBadgesResponse()
  @ApiBadRequestAndInternal()
  async listMyBadges(@CurrentUser('sub') userId: string, @Query() query: ListUserBadgesQueryDto) {
    const result = await this.userApplicationService.listUserBadges(userId, userId, {
      limit: query.limit,
      cursor: query.cursor,
    });
    return this.presenter.listMyBadges(result);
  }

  @Get('me/activity')
  @ApiAuth()
  @ApiOperation({
    summary: 'List my activity events',
    description:
      'Returns a cursor-paginated list of activity events for the authenticated user. ' +
      'Honours the `showActivity` privacy flag (403 when the flag is false and the requester ' +
      'is not the owner).',
  })
  @ApiUserActivityResponse()
  @ApiBadRequestAndInternal()
  async listMyActivity(
    @CurrentUser('sub') userId: string,
    @Query() query: ListUserActivityQueryDto,
  ) {
    const result = await this.userApplicationService.listMyActivity(userId, {
      limit: query.limit,
      cursor: query.cursor,
    });
    return this.presenter.listMyActivity(result);
  }

  @Get('me/tournaments')
  @ApiAuth()
  @ApiOperation({
    summary: 'List my tournaments',
    description:
      'Returns a cursor-paginated list of tournaments the authenticated user participates in.',
  })
  @ApiMyTournamentsResponse()
  @ApiBadRequestAndInternal()
  async listMyTournaments(
    @CurrentUser('sub') userId: string,
    @Query() query: GetMyTournamentsQueryDto,
  ) {
    const result = await this.userApplicationService.getMyTournaments(userId, userId, query);
    return this.presenter.listMyTournaments(result);
  }

  @Get('me/tournament-history')
  @ApiAuth()
  @ApiOperation({
    summary: 'List my tournament history',
    description:
      'Returns a cursor-paginated list of completed tournaments the authenticated user participated in.',
  })
  @ApiMyTournamentHistoryResponse()
  @ApiBadRequestAndInternal()
  async listMyTournamentHistory(
    @CurrentUser('sub') userId: string,
    @Query() query: GetMyTournamentHistoryQueryDto,
  ) {
    const result = await this.userApplicationService.getMyTournamentHistory(userId, userId, query);
    return this.presenter.listMyTournamentHistory(result);
  }

  @Get('me/tournaments/analytics')
  @ApiAuth()
  @ApiOperation({
    summary: 'Get my tournament analytics',
    description: 'Returns aggregate tournament analytics for the authenticated user.',
  })
  @ApiMyTournamentAnalyticsResponse()
  @ApiInternalError()
  async getMyTournamentAnalytics(@CurrentUser('sub') userId: string) {
    const result = await this.userApplicationService.getMyTournamentAnalytics(userId);
    return this.presenter.getMyTournamentAnalytics(result);
  }

  @Get('me/ranking')
  @ApiAuth()
  @ApiOperation({
    summary: 'Get my ranking',
    description: "Returns the authenticated user's global ranking.",
  })
  @ApiUserRankingResponse()
  @ApiInternalError()
  async getMyRanking(@CurrentUser('sub') userId: string) {
    const result = await this.userApplicationService.getUserRanking(userId, userId);
    return this.presenter.getUserRanking(result);
  }

  @Get('me/analytics')
  @ApiAuth()
  @ApiOperation({
    summary: 'Get my analytics',
    description: "Returns the authenticated user's aggregate analytics summary.",
  })
  @ApiUserAnalyticsResponse()
  @ApiInternalError()
  async getMyAnalytics(@CurrentUser('sub') userId: string) {
    const result = await this.userApplicationService.getUserAnalytics(userId, userId);
    return this.presenter.getUserAnalytics(result);
  }

  @Patch('me')
  @ApiAuth()
  @ApiOperation({
    summary: 'Update my profile',
    description:
      "Updates the authenticated user's profile fields. Pass `null` (or a blank string) to clear `displayName`, `bio`, or `avatarUrl`.",
  })
  @ApiUserMeUpdatedResponse()
  @ApiBadRequestAndInternal()
  async updateMe(@CurrentUser('sub') userId: string, @Body() payload: UpdateMeDto) {
    const result = await this.userApplicationService.updateProfile(userId, payload);
    return this.presenter.updateMe(result);
  }

  @Patch('me/settings')
  @ApiAuth()
  @ApiOperation({
    summary: 'Update my settings',
    description: "Replaces the authenticated user's preference object.",
  })
  @ApiUserSettingsUpdatedResponse()
  @ApiBadRequestAndInternal()
  async updateMeSettings(@CurrentUser('sub') userId: string, @Body() payload: UpdateMeSettingsDto) {
    const result = await this.userApplicationService.updateSettings(userId, payload);
    return this.presenter.updateMeSettings(result);
  }

  // ─── Authenticated, privacy-gated :userId routes ──
  // Phase 8 (F-25, F-31): these routes all live behind `@ApiAuth()` —
  // every caller must be authenticated (the global `JwtGuard` enforces
  // that at the framework level, `@ApiAuth()` documents it in OpenAPI).
  // They are NOT public in the literal sense; the audit previously
  // labelled them "Public :userId routes" which was misleading.
  //
  // Cross-user reads are also privacy-gated via
  // `assertProfileVisible` (F-4) and `assertPrivacyFlag` (F-7); the
  // `/me/*` literal routes above are matched first by Nest's
  // registration-order routing, so this `:userId` block cannot
  // accidentally swallow a self-request — there is no shadowing
  // concern. Order within this block is otherwise immaterial: each
  // route has a distinct sub-path.

  @Get(':userId/quizzes/analytics')
  @ApiUserIdParam()
  @ApiAuth()
  @ApiOperation({
    summary: 'Get creator analytics for a user',
    description:
      'Returns aggregate creator-side quiz analytics for the given user. ' +
      'Restricted to the authenticated user — calling this endpoint for any other ' +
      '`userId` returns 404. This is the same data exposed at `GET /users/me/analytics` ' +
      'and `GET /users/me/tournament-analytics`, but scoped to a creator role.',
  })
  @ApiCreatorQuizAnalyticsResponse()
  @ApiNotFoundAndInternal()
  async getUserQuizAnalytics(
    @Param('userId', new ParseUUIDPipe({ version: '7' })) userId: string,
    @CurrentUser('sub') requesterId: string,
  ) {
    // Phase 1 (F-1): gate cross-user access. Only the target user themselves
    // may read their own creator analytics — every other authenticated caller
    // receives 404, identical to a missing user. This fixes the IDOR reported
    // in `docs/audits/USER_MODULE_PRODUCTION_READINESS_AUDIT.md` (F-1).
    this.userDomainService.assertCanReadCreatorAnalytics(requesterId, userId);
    const result = await this.quizListing.getMyQuizAnalytics(userId);
    return this.presenter.getUserQuizAnalytics(result);
  }

  @Get(':userId/quizzes')
  @ApiUserIdParam()
  @ApiAuth()
  @ApiOperation({
    summary: 'List quizzes created by a user',
    description: 'Returns a cursor-paginated list of quizzes created by the specified user.',
  })
  @ApiUserQuizListResponse()
  @ApiNotFoundBadRequestInternal()
  async listUserQuizzes(
    @Param('userId', new ParseUUIDPipe({ version: '7' })) userId: string,
    @Query() query: ListQuizzesQueryDto,
  ) {
    const result = await this.quizListing.listQuizzesByCreator(userId, query);
    return this.presenter.listUserQuizzes(result);
  }

  @Get(':userId/badges')
  @ApiUserIdParam()
  @ApiAuth()
  @ApiOperation({
    summary: 'List badges earned by a user',
    description:
      "Returns a cursor-paginated list of badges earned by the specified user. Honours the user's privacy settings — private profiles return 403.",
  })
  @ApiUserBadgesResponse()
  @ApiNotFoundBadRequestForbiddenInternal()
  async listBadgesByUserId(
    @Param('userId', new ParseUUIDPipe({ version: '7' })) userId: string,
    @Query() query: ListUserBadgesQueryDto,
    @CurrentUser('sub') requesterId: string,
  ) {
    const result = await this.userApplicationService.listUserBadges(userId, requesterId, {
      limit: query.limit,
      cursor: query.cursor,
    });
    return this.presenter.listBadgesByUserId(result);
  }

  @Get(':userId/tournament-history')
  @ApiUserIdParam()
  @ApiAuth()
  @ApiOperation({
    summary: 'Get public tournament history for a user',
    description:
      'Returns a cursor-paginated list of completed tournaments for the specified user. ' +
      "Honours the target user's `showTournamentActivity` privacy flag (403 when the flag is " +
      'false and the requester is not the owner).',
  })
  @ApiPublicTournamentHistoryResponse()
  @ApiNotFoundBadRequestForbiddenInternal()
  async getUserTournamentHistory(
    @Param('userId', new ParseUUIDPipe({ version: '7' })) userId: string,
    @Query() query: GetMyTournamentHistoryQueryDto,
    @CurrentUser('sub') requesterId: string,
  ) {
    const result = await this.userApplicationService.getPublicTournamentHistory(
      userId,
      requesterId,
      query,
    );
    return this.presenter.getUserTournamentHistory(result);
  }

  @Get(':userId/tournaments')
  @ApiUserIdParam()
  @ApiAuth()
  @ApiOperation({
    summary: 'Get public tournament profile for a user',
    description:
      'Returns aggregate tournament stats for the specified user. Honours privacy settings.',
  })
  @ApiPublicTournamentProfileResponse()
  @ApiNotFoundForbiddenInternal()
  async getPublicTournamentProfile(
    @Param('userId', new ParseUUIDPipe({ version: '7' })) userId: string,
    @CurrentUser('sub') requesterId: string,
  ) {
    const result = await this.userApplicationService.getPublicTournamentProfile(
      userId,
      requesterId,
    );
    return this.presenter.getPublicTournamentProfile(result);
  }
}
