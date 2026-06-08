import { Body, Controller, Get, Param, Patch, Query, UseFilters } from '@nestjs/common';
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
import { QuizApplicationService } from '@/modules/quiz/application/quiz.application.service';
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
import { UserMeResponseDto } from './dto/response/user-me-response.dto';
import { UserBadgesResponseDto } from './dto/response/user-badges-response.dto';
import { UserRankingResponseDto } from './dto/response/user-ranking-response.dto';
import { UserAnalyticsResponseDto } from './dto/response/user-analytics-response.dto';
import { UserApplicationService } from './application/user.application.service';
import { UserActivityCursorMapper } from './mappers/user-activity-cursor.mapper';
import { UserDomainExceptionFilter } from './transport/filters/user-domain-exception.filter';
import { UserBadgeCursorMapper } from './mappers/user-badge-cursor.mapper';

@ApiTags('users')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid authentication token' })
@ApiForbiddenResponse({ description: 'Authenticated user lacks required role or permission' })
@Controller('users')
@UseFilters(UserDomainExceptionFilter)
export class UserController {
  constructor(
    private readonly userApplicationService: UserApplicationService,
    private readonly quizApplicationService: QuizApplicationService,
  ) {}

  @Get('me/recommended-quizzes')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get recommended quizzes',
    description:
      "Returns personalized quiz recommendations for the authenticated user based on their attempt history, ranked by category match, tag match, popularity, and trending score.",
  })
  @ApiOkResponse({ description: 'Recommended quizzes returned', type: RelatedQuizzesResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication token' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  @ApiValidationRequest()
  getRecommendedQuizzes(
    @CurrentUser('sub') userId: string,
    @Query() query: RecommendedQuizzesQueryDto,
  ): Promise<RelatedQuizzesResponseDto> {
    return this.quizApplicationService.getRecommendedQuizzes(userId, query);
  }

  @Get(':userId/quizzes')
  @ApiOperation({
    summary: 'List quizzes created by user',
    description:
      "Returns a paginated, cursor-based list of quizzes created by the specified user, ordered by newest first.",
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
    return this.quizApplicationService.listQuizzesByCreator(userId, query);
  }

  @Get(':userId/badges')
  @ApiOperation({
    summary: 'List badges earned by user',
    description:
      'Returns the specified user\'s earned badges, cursor-paginated and ordered by most recently earned.',
  })
  @ApiOkResponse({ description: 'Badges returned', type: UserBadgesResponseDto })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  @ApiValidationRequest()
  listBadgesByUserId(
    @Param('userId') userId: string,
    @Query() query: ListUserBadgesQueryDto,
  ): Promise<UserBadgesResponseDto> {
    const cursor = query.cursor ? UserBadgeCursorMapper.parse(query.cursor) : null;

    return this.userApplicationService.listBadgesByUserId(userId, {
      limit: query.limit,
      cursor,
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
    const cursor = query.cursor ? UserBadgeCursorMapper.parse(query.cursor) : null;

    return this.userApplicationService.listUserBadges(userId, {
      limit: query.limit,
      cursor,
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
    const cursor = query.cursor ? UserActivityCursorMapper.parse(query.cursor) : null;

    return this.userApplicationService.listUserActivity(userId, {
      limit: query.limit,
      cursor,
    });
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
    return this.userApplicationService.getMyTournaments(userId, query);
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
    return this.userApplicationService.getMyTournamentHistory(userId, query);
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
    return this.userApplicationService.getUserRanking(userId);
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
    return this.userApplicationService.getUserAnalytics(userId);
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
