import { Body, Controller, Get, Inject, Param, Patch, Query, UseFilters } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiBearerAuth,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
  ApiInternalServerErrorResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { ApiValidationRequest } from '@/common/swagger/swagger-decorators';
import { CreatorQuizAnalyticsDto } from '@/modules/quiz/dto/response/quiz-analytics.dto';
import { RecommendedQuizzesQueryDto } from '@/modules/quiz/dto/request/recommended-quizzes-query.dto';
import { ListQuizzesQueryDto } from '@/modules/quiz/dto/request/list-quizzes-query.dto';
import { QuizListResponseDto } from '@/modules/quiz/dto/response/quiz-list-response.dto';
import { RelatedQuizzesResponseDto } from '@/modules/quiz/dto/response/related-quizzes-response.dto';
import { ListUserActivityQueryDto } from './dto/request/list-user-activity-query.dto';
import { GetMyTournamentsQueryDto } from './dto/request/get-my-tournaments-query.dto';
import { GetMyTournamentHistoryQueryDto } from './dto/request/get-my-tournament-history-query.dto';
import { UpdateMeSettingsDto } from './dto/request/update-me-settings.dto';
import { UpdateMeDto } from './dto/request/update-me.dto';
import { ListUserBadgesQueryDto } from './dto/request/list-user-badges-query.dto';
import { UserActivityResponseDto } from './dto/response/user-activity-response.dto';
import { MyTournamentsResponseDto } from './dto/response/my-tournaments-response.dto';
import { MyTournamentHistoryResponseDto } from './dto/response/my-tournament-history-response.dto';
import { MyTournamentAnalyticsResponseDto } from './dto/response/my-tournament-analytics-response.dto';
import { PublicTournamentProfileResponseDto } from './dto/response/public-tournament-profile-response.dto';
import { UserMeResponseDto } from './dto/response/user-me-response.dto';
import { UserBadgesResponseDto } from './dto/response/user-badges-response.dto';
import { UserRankingResponseDto } from './dto/response/user-ranking-response.dto';
import { UserAnalyticsResponseDto } from './dto/response/user-analytics-response.dto';
import { UserApplicationService } from './application/user.application.service';
import { UserDomainExceptionFilter } from './transport/filters/user-domain-exception.filter';
import { QUIZ_LISTING_PORT, type QuizListingPort } from '@/modules/quiz/domain/analytics';

@ApiTags('users')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid authentication token' })
@ApiForbiddenResponse({ description: 'Authenticated user lacks required role or permission' })
@Controller('users')
@UseFilters(UserDomainExceptionFilter)
export class UserController {
  constructor(
    private readonly userApplicationService: UserApplicationService,
    @Inject(QUIZ_LISTING_PORT)
    private readonly quizListing: QuizListingPort,
  ) {}

  @Get('me/recommended-quizzes')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get recommended quizzes',
    description:
      'Returns personalized quiz recommendations for the authenticated user based on their attempt history, ranked by category match, tag match, popularity, and trending score.',
  })
  @ApiOkResponse({ description: 'Recommended quizzes returned', type: RelatedQuizzesResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication token' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  @ApiValidationRequest()
  getRecommendedQuizzes(
    @CurrentUser('sub') userId: string,
    @Query() query: RecommendedQuizzesQueryDto,
  ): Promise<RelatedQuizzesResponseDto> {
    return this.quizListing.getRecommendedQuizzes(userId, query);
  }

  @Get(':userId/quizzes/analytics')
  @ApiOperation({
    summary: 'Get quiz analytics by creator',
    description:
      'Returns creator-level analytics aggregated across all quizzes owned by the specified user.',
  })
  @ApiOkResponse({ description: 'Quiz analytics returned', type: CreatorQuizAnalyticsDto })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  getUserQuizAnalytics(@Param('userId') userId: string): Promise<CreatorQuizAnalyticsDto> {
    return this.quizListing.getMyQuizAnalytics(userId);
  }

  @Get(':userId/quizzes')
  @ApiOperation({
    summary: 'List quizzes created by user',
    description:
      'Returns a paginated, cursor-based list of quizzes created by the specified user, ordered by newest first.',
  })
  @ApiOkResponse({ description: 'Quizzes returned', type: QuizListResponseDto })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  @ApiValidationRequest()
  listUserQuizzes(
    @Param('userId') userId: string,
    @Query() query: ListQuizzesQueryDto,
  ): Promise<QuizListResponseDto> {
    return this.quizListing.listQuizzesByCreator(userId, query);
  }

  @Get(':userId/badges')
  @ApiOperation({
    summary: 'List badges earned by user',
    description:
      "Returns the specified user's earned badges, cursor-paginated and ordered by most recently earned.",
  })
  @ApiOkResponse({ description: 'Badges returned', type: UserBadgesResponseDto })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  @ApiValidationRequest()
  listBadgesByUserId(
    @Param('userId') userId: string,
    @Query() query: ListUserBadgesQueryDto,
    @CurrentUser('sub') requesterId: string,
  ): Promise<UserBadgesResponseDto> {
    return this.userApplicationService.listUserBadges(userId, requesterId, {
      limit: query.limit,
      cursor: query.cursor,
    });
  }

  @Get('me')
  @ApiOperation({
    summary: 'Get current user profile',
    description:
      "Returns the authenticated user's full profile including XP, streaks, and settings.",
  })
  @ApiOkResponse({ description: 'Profile returned', type: UserMeResponseDto })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  me(@CurrentUser('sub') userId: string): Promise<UserMeResponseDto> {
    return this.userApplicationService.getMe(userId);
  }

  @Get('me/badges')
  @ApiOperation({
    summary: 'List my badges',
    description:
      "Returns the authenticated user's earned badges, cursor-paginated and ordered by most recently earned.",
  })
  @ApiOkResponse({ description: 'Badges returned', type: UserBadgesResponseDto })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  @ApiValidationRequest()
  listMyBadges(
    @CurrentUser('sub') userId: string,
    @Query() query: ListUserBadgesQueryDto,
  ): Promise<UserBadgesResponseDto> {
    return this.userApplicationService.listUserBadges(userId, userId, {
      limit: query.limit,
      cursor: query.cursor,
    });
  }

  @Get('me/activity')
  @ApiOperation({
    summary: 'My activity',
    description:
      "Returns the authenticated user's activity events, cursor-paginated and ordered by most recent activity.",
  })
  @ApiOkResponse({ description: 'Activity returned', type: UserActivityResponseDto })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  listUserActivity(
    @CurrentUser('sub') userId: string,
    @Query() query: ListUserActivityQueryDto,
  ): Promise<UserActivityResponseDto> {
    return this.userApplicationService.listUserActivity(userId, {
      limit: query.limit,
      cursor: query.cursor,
    });
  }

  @Get(':userId/tournament-history')
  @ApiOperation({
    summary: 'Get public tournament history',
    description:
      "Returns the specified user's completed tournament participation history, paginated by page and limit and ordered by most recent completion first.",
  })
  @ApiOkResponse({
    description: 'Tournament history returned',
    type: MyTournamentHistoryResponseDto,
  })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  @ApiValidationRequest()
  getUserTournamentHistory(
    @Param('userId') userId: string,
    @Query() query: GetMyTournamentHistoryQueryDto,
    @CurrentUser('sub') requesterId: string,
  ): Promise<MyTournamentHistoryResponseDto> {
    return this.userApplicationService.getMyTournamentHistory(userId, requesterId, query);
  }

  @Get(':userId/tournaments')
  @ApiOperation({
    summary: 'Get public tournament profile',
    description:
      "Returns the specified user's public tournament performance summary calculated from completed tournaments only.",
  })
  @ApiOkResponse({
    description: 'Tournament profile returned',
    type: PublicTournamentProfileResponseDto,
  })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  getPublicTournamentProfile(
    @Param('userId') userId: string,
    @CurrentUser('sub') requesterId: string,
  ): Promise<PublicTournamentProfileResponseDto> {
    return this.userApplicationService.getPublicTournamentProfile(userId, requesterId);
  }

  @Get('me/tournaments')
  @ApiOperation({
    summary: 'List my tournaments',
    description:
      'Returns tournaments the authenticated user has registered for or participated in, paginated by page and limit and ordered by most recent registration first.',
  })
  @ApiOkResponse({ description: 'My tournaments returned', type: MyTournamentsResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  @ApiValidationRequest()
  listMyTournaments(
    @CurrentUser('sub') userId: string,
    @Query() query: GetMyTournamentsQueryDto,
  ): Promise<MyTournamentsResponseDto> {
    return this.userApplicationService.getMyTournaments(userId, userId, query);
  }

  @Get('me/tournament-history')
  @ApiOperation({
    summary: 'List my tournament history',
    description:
      'Returns completed tournament participation history for the authenticated user, paginated by page and limit and ordered by most recent completion first.',
  })
  @ApiOkResponse({
    description: 'My tournament history returned',
    type: MyTournamentHistoryResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  @ApiValidationRequest()
  listMyTournamentHistory(
    @CurrentUser('sub') userId: string,
    @Query() query: GetMyTournamentHistoryQueryDto,
  ): Promise<MyTournamentHistoryResponseDto> {
    return this.userApplicationService.getMyTournamentHistory(userId, userId, query);
  }

  @Get('me/tournaments/analytics')
  @ApiOperation({
    summary: 'Get my tournament analytics',
    description:
      "Returns the authenticated user's tournament participation analytics calculated from completed tournaments.",
  })
  @ApiOkResponse({
    description: 'Tournament analytics returned',
    type: MyTournamentAnalyticsResponseDto,
  })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  getMyTournamentAnalytics(
    @CurrentUser('sub') userId: string,
  ): Promise<MyTournamentAnalyticsResponseDto> {
    return this.userApplicationService.getMyTournamentAnalytics(userId);
  }

  @Get('me/ranking')
  @ApiOperation({
    summary: 'Get my ranking',
    description:
      "Returns the authenticated user's current ranking summary using the existing user_ranking table.",
  })
  @ApiOkResponse({ description: 'Ranking returned', type: UserRankingResponseDto })
  @ApiNotFoundResponse({ description: 'User or ranking record not found' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  getMyRanking(@CurrentUser('sub') userId: string): Promise<UserRankingResponseDto> {
    return this.userApplicationService.getUserRanking(userId, userId);
  }

  @Get('me/analytics')
  @ApiOperation({
    summary: 'Get my analytics',
    description:
      "Returns the authenticated user's quiz analytics including attempt summary and favorite category/tag.",
  })
  @ApiOkResponse({ description: 'Analytics returned', type: UserAnalyticsResponseDto })
  @ApiNotFoundResponse({ description: 'User not found or no analytics data available' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  getMyAnalytics(@CurrentUser('sub') userId: string): Promise<UserAnalyticsResponseDto> {
    return this.userApplicationService.getUserAnalytics(userId, userId);
  }

  @Patch('me')
  @ApiOperation({
    summary: 'Update profile',
    description: "Updates the authenticated user's display name, bio, or avatar URL.",
  })
  @ApiOkResponse({ description: 'Profile updated', type: UserMeResponseDto })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  @ApiValidationRequest()
  updateMe(
    @CurrentUser('sub') userId: string,
    @Body() payload: UpdateMeDto,
  ): Promise<UserMeResponseDto> {
    return this.userApplicationService.updateProfile(userId, payload);
  }

  @Patch('me/settings')
  @ApiOperation({
    summary: 'Update settings',
    description: "Replaces the authenticated user's entire settings object.",
  })
  @ApiOkResponse({ description: 'Settings updated', type: UserMeResponseDto })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  @ApiValidationRequest()
  updateMeSettings(
    @CurrentUser('sub') userId: string,
    @Body() payload: UpdateMeSettingsDto,
  ): Promise<UserMeResponseDto> {
    return this.userApplicationService.updateSettings(userId, payload);
  }
}
