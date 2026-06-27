import { Body, Controller, Get, Inject, Param, Patch, Query, UseFilters } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { ApiAuth } from '@/common/swagger/swagger-decorators';
import { RecommendedQuizzesQueryDto } from '@/modules/quiz/dto/request/recommended-quizzes-query.dto';
import { QuizResponseDto } from '@/modules/quiz/dto/response/quiz-response.dto';
import { ListQuizzesQueryDto } from '@/modules/quiz/dto/request/list-quizzes-query.dto';
import { QuizListResponseDto } from '@/modules/quiz/dto/response/quiz-list-response.dto';
import { CreatorQuizAnalyticsDto } from '@/modules/quiz/dto/response/quiz-analytics.dto';
import { GetMyTournamentsQueryDto } from '../../dto/request/get-my-tournaments-query.dto';
import { GetMyTournamentHistoryQueryDto } from '../../dto/request/get-my-tournament-history-query.dto';
import { ListUserActivityQueryDto } from '../../dto/request/list-user-activity-query.dto';
import { ListUserBadgesQueryDto } from '../../dto/request/list-user-badges-query.dto';
import { UpdateMeDto } from '../../dto/request/update-me.dto';
import { UpdateMeSettingsDto } from '../../dto/request/update-me-settings.dto';
import { MyTournamentAnalyticsResponseDto } from '../../dto/response/my-tournament-analytics.dto';
import { MyTournamentHistoryResponseDto } from '../../dto/response/my-tournament-history.dto';
import { MyTournamentsResponseDto } from '../../dto/response/my-tournaments.dto';
import { PublicTournamentProfileResponseDto } from '../../dto/response/public-tournament-profile.dto';
import { UserActivityResponseDto } from '../../dto/response/user-activity.dto';
import { UserAnalyticsResponseDto } from '../../dto/response/user-analytics.dto';
import { UserBadgesResponseDto } from '../../dto/response/user-badges.dto';
import { UserMeResponseDto } from '../../dto/response/user-me.dto';
import { UserRankingResponseDto } from '../../dto/response/user-ranking.dto';
import { UserApplicationService } from '../../application/user.application.service';
import { UserDomainExceptionFilter } from '../filters/user-domain-exception.filter';
import { QUIZ_LISTING_PORT, type QuizListingPort } from '@/modules/quiz/domain/analytics';
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
@UseFilters(UserDomainExceptionFilter)
export class UserController {
  constructor(
    private readonly userApplicationService: UserApplicationService,
    @Inject(QUIZ_LISTING_PORT)
    private readonly quizListing: QuizListingPort,
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
  ): Promise<QuizResponseDto[]> {
    const { items } = await this.quizListing.getRecommendedQuizzes(userId, query);
    return items;
  }

  @Get(':userId/quizzes/analytics')
  @ApiOperation({
    summary: 'Get creator analytics for a user',
    description: 'Returns aggregate creator-side quiz analytics for the given user.',
  })
  @ApiCreatorQuizAnalyticsResponse()
  @ApiNotFoundAndInternal()
  getUserQuizAnalytics(@Param('userId') userId: string): Promise<CreatorQuizAnalyticsDto> {
    return this.quizListing.getMyQuizAnalytics(userId);
  }

  @Get(':userId/quizzes')
  @ApiOperation({
    summary: 'List quizzes created by a user',
    description: 'Returns a cursor-paginated list of quizzes created by the specified user.',
  })
  @ApiUserQuizListResponse()
  @ApiNotFoundBadRequestInternal()
  listUserQuizzes(
    @Param('userId') userId: string,
    @Query() query: ListQuizzesQueryDto,
  ): Promise<QuizListResponseDto> {
    return this.quizListing.listQuizzesByCreator(userId, query);
  }

  @Get(':userId/badges')
  @ApiOperation({
    summary: 'List badges earned by a user',
    description:
      "Returns a cursor-paginated list of badges earned by the specified user. Honours the user's privacy settings — private profiles return 403.",
  })
  @ApiUserBadgesResponse()
  @ApiNotFoundBadRequestForbiddenInternal()
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
  @ApiAuth()
  @ApiOperation({
    summary: 'Get my profile',
    description: "Returns the authenticated user's full profile.",
  })
  @ApiUserMeResponse()
  @ApiInternalError()
  me(@CurrentUser('sub') userId: string): Promise<UserMeResponseDto> {
    return this.userApplicationService.getMe(userId);
  }

  @Get('me/badges')
  @ApiAuth()
  @ApiOperation({
    summary: 'List my earned badges',
    description: 'Returns a cursor-paginated list of badges earned by the authenticated user.',
  })
  @ApiUserBadgesResponse()
  @ApiBadRequestAndInternal()
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
  @ApiAuth()
  @ApiOperation({
    summary: 'List my activity events',
    description: 'Returns a cursor-paginated list of activity events for the authenticated user.',
  })
  @ApiUserActivityResponse()
  @ApiBadRequestAndInternal()
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
    summary: 'Get public tournament history for a user',
    description:
      'Returns a cursor-paginated list of completed tournaments for the specified user. Honours privacy settings.',
  })
  @ApiPublicTournamentHistoryResponse()
  @ApiNotFoundBadRequestForbiddenInternal()
  getUserTournamentHistory(
    @Param('userId') userId: string,
    @Query() query: GetMyTournamentHistoryQueryDto,
    @CurrentUser('sub') requesterId: string,
  ): Promise<MyTournamentHistoryResponseDto> {
    return this.userApplicationService.getMyTournamentHistory(userId, requesterId, query);
  }

  @Get(':userId/tournaments')
  @ApiOperation({
    summary: 'Get public tournament profile for a user',
    description:
      'Returns aggregate tournament stats for the specified user. Honours privacy settings.',
  })
  @ApiPublicTournamentProfileResponse()
  @ApiNotFoundForbiddenInternal()
  getPublicTournamentProfile(
    @Param('userId') userId: string,
    @CurrentUser('sub') requesterId: string,
  ): Promise<PublicTournamentProfileResponseDto> {
    return this.userApplicationService.getPublicTournamentProfile(userId, requesterId);
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
  listMyTournaments(
    @CurrentUser('sub') userId: string,
    @Query() query: GetMyTournamentsQueryDto,
  ): Promise<MyTournamentsResponseDto> {
    return this.userApplicationService.getMyTournaments(userId, userId, query);
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
  listMyTournamentHistory(
    @CurrentUser('sub') userId: string,
    @Query() query: GetMyTournamentHistoryQueryDto,
  ): Promise<MyTournamentHistoryResponseDto> {
    return this.userApplicationService.getMyTournamentHistory(userId, userId, query);
  }

  @Get('me/tournaments/analytics')
  @ApiAuth()
  @ApiOperation({
    summary: 'Get my tournament analytics',
    description: 'Returns aggregate tournament analytics for the authenticated user.',
  })
  @ApiMyTournamentAnalyticsResponse()
  @ApiInternalError()
  getMyTournamentAnalytics(
    @CurrentUser('sub') userId: string,
  ): Promise<MyTournamentAnalyticsResponseDto> {
    return this.userApplicationService.getMyTournamentAnalytics(userId);
  }

  @Get('me/ranking')
  @ApiAuth()
  @ApiOperation({
    summary: 'Get my ranking',
    description: "Returns the authenticated user's global ranking.",
  })
  @ApiUserRankingResponse()
  @ApiInternalError()
  getMyRanking(@CurrentUser('sub') userId: string): Promise<UserRankingResponseDto> {
    return this.userApplicationService.getUserRanking(userId, userId);
  }

  @Get('me/analytics')
  @ApiAuth()
  @ApiOperation({
    summary: 'Get my analytics',
    description: "Returns the authenticated user's aggregate analytics summary.",
  })
  @ApiUserAnalyticsResponse()
  @ApiInternalError()
  getMyAnalytics(@CurrentUser('sub') userId: string): Promise<UserAnalyticsResponseDto> {
    return this.userApplicationService.getUserAnalytics(userId, userId);
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
  updateMe(
    @CurrentUser('sub') userId: string,
    @Body() payload: UpdateMeDto,
  ): Promise<UserMeResponseDto> {
    return this.userApplicationService.updateProfile(userId, payload);
  }

  @Patch('me/settings')
  @ApiAuth()
  @ApiOperation({
    summary: 'Update my settings',
    description: "Replaces the authenticated user's preference object.",
  })
  @ApiUserSettingsUpdatedResponse()
  @ApiBadRequestAndInternal()
  updateMeSettings(
    @CurrentUser('sub') userId: string,
    @Body() payload: UpdateMeSettingsDto,
  ): Promise<UserMeResponseDto> {
    return this.userApplicationService.updateSettings(userId, payload);
  }
}
