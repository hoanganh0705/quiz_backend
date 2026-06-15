import { Body, Controller, Get, Inject, Param, Patch, Query, UseFilters } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import {
  ApiAuthList,
  ApiPublicList,
  ApiInternalError,
  ApiAuthUpdate,
} from '@/common/swagger/swagger-decorators';
import { CreatorQuizAnalyticsDto } from '@/modules/quiz/dto/response/quiz-analytics.dto';
import { RecommendedQuizzesQueryDto } from '@/modules/quiz/dto/request/recommended-quizzes-query.dto';
import { ListQuizzesQueryDto } from '@/modules/quiz/dto/request/list-quizzes-query.dto';
import { QuizListResponseDto } from '@/modules/quiz/dto/response/quiz-list-response.dto';
import { RelatedQuizzesResponseDto } from '@/modules/quiz/dto/response/related-quizzes-response.dto';
import { ListUserActivityQueryDto } from '../../dto/request/list-user-activity-query.dto';
import { GetMyTournamentsQueryDto } from '../../dto/request/get-my-tournaments-query.dto';
import { GetMyTournamentHistoryQueryDto } from '../../dto/request/get-my-tournament-history-query.dto';
import { UpdateMeSettingsDto } from '../../dto/request/update-me-settings.dto';
import { UpdateMeDto } from '../../dto/request/update-me.dto';
import { ListUserBadgesQueryDto } from '../../dto/request/list-user-badges-query.dto';
import { UserActivityResponseDto } from '../../dto/response/user-activity-response.dto';
import { MyTournamentsResponseDto } from '../../dto/response/my-tournaments-response.dto';
import { MyTournamentHistoryResponseDto } from '../../dto/response/my-tournament-history-response.dto';
import { MyTournamentAnalyticsResponseDto } from '../../dto/response/my-tournament-analytics-response.dto';
import { PublicTournamentProfileResponseDto } from '../../dto/response/public-tournament-profile-response.dto';
import { UserMeResponseDto } from '../../dto/response/user-me-response.dto';
import { UserBadgesResponseDto } from '../../dto/response/user-badges-response.dto';
import { UserRankingResponseDto } from '../../dto/response/user-ranking-response.dto';
import { UserAnalyticsResponseDto } from '../../dto/response/user-analytics-response.dto';
import { UserApplicationService } from '../../application/user.application.service';
import { UserDomainExceptionFilter } from '../filters/user-domain-exception.filter';
import { QUIZ_LISTING_PORT, type QuizListingPort } from '@/modules/quiz/domain/analytics';

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
  @ApiAuthList({ description: 'Recommended quizzes returned', type: RelatedQuizzesResponseDto })
  @ApiInternalError()
  getRecommendedQuizzes(
    @CurrentUser('sub') userId: string,
    @Query() query: RecommendedQuizzesQueryDto,
  ): Promise<RelatedQuizzesResponseDto> {
    return this.quizListing.getRecommendedQuizzes(userId, query);
  }

  @Get(':userId/quizzes/analytics')
  @ApiPublicList({ description: 'Quiz analytics returned', type: CreatorQuizAnalyticsDto })
  getUserQuizAnalytics(@Param('userId') userId: string): Promise<CreatorQuizAnalyticsDto> {
    return this.quizListing.getMyQuizAnalytics(userId);
  }

  @Get(':userId/quizzes')
  @ApiPublicList({ description: 'Quizzes returned', type: QuizListResponseDto })
  listUserQuizzes(
    @Param('userId') userId: string,
    @Query() query: ListQuizzesQueryDto,
  ): Promise<QuizListResponseDto> {
    return this.quizListing.listQuizzesByCreator(userId, query);
  }

  @Get(':userId/badges')
  @ApiPublicList({ description: 'Badges returned', type: UserBadgesResponseDto })
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
  @ApiAuthList({ description: 'Profile returned', type: UserMeResponseDto })
  me(@CurrentUser('sub') userId: string): Promise<UserMeResponseDto> {
    return this.userApplicationService.getMe(userId);
  }

  @Get('me/badges')
  @ApiAuthList({ description: 'Badges returned', type: UserBadgesResponseDto })
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
  @ApiAuthList({ description: 'Activity returned', type: UserActivityResponseDto })
  @ApiInternalError()
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
  @ApiPublicList({
    description: 'Tournament history returned',
    type: MyTournamentHistoryResponseDto,
  })
  getUserTournamentHistory(
    @Param('userId') userId: string,
    @Query() query: GetMyTournamentHistoryQueryDto,
    @CurrentUser('sub') requesterId: string,
  ): Promise<MyTournamentHistoryResponseDto> {
    return this.userApplicationService.getMyTournamentHistory(userId, requesterId, query);
  }

  @Get(':userId/tournaments')
  @ApiPublicList({
    description: 'Tournament profile returned',
    type: PublicTournamentProfileResponseDto,
  })
  getPublicTournamentProfile(
    @Param('userId') userId: string,
    @CurrentUser('sub') requesterId: string,
  ): Promise<PublicTournamentProfileResponseDto> {
    return this.userApplicationService.getPublicTournamentProfile(userId, requesterId);
  }

  @Get('me/tournaments')
  @ApiAuthList({ description: 'My tournaments returned', type: MyTournamentsResponseDto })
  listMyTournaments(
    @CurrentUser('sub') userId: string,
    @Query() query: GetMyTournamentsQueryDto,
  ): Promise<MyTournamentsResponseDto> {
    return this.userApplicationService.getMyTournaments(userId, userId, query);
  }

  @Get('me/tournament-history')
  @ApiAuthList({
    description: 'My tournament history returned',
    type: MyTournamentHistoryResponseDto,
  })
  listMyTournamentHistory(
    @CurrentUser('sub') userId: string,
    @Query() query: GetMyTournamentHistoryQueryDto,
  ): Promise<MyTournamentHistoryResponseDto> {
    return this.userApplicationService.getMyTournamentHistory(userId, userId, query);
  }

  @Get('me/tournaments/analytics')
  @ApiAuthList({
    description: 'Tournament analytics returned',
    type: MyTournamentAnalyticsResponseDto,
  })
  @ApiInternalError()
  getMyTournamentAnalytics(
    @CurrentUser('sub') userId: string,
  ): Promise<MyTournamentAnalyticsResponseDto> {
    return this.userApplicationService.getMyTournamentAnalytics(userId);
  }

  @Get('me/ranking')
  @ApiAuthList({ description: 'Ranking returned', type: UserRankingResponseDto })
  @ApiInternalError()
  getMyRanking(@CurrentUser('sub') userId: string): Promise<UserRankingResponseDto> {
    return this.userApplicationService.getUserRanking(userId, userId);
  }

  @Get('me/analytics')
  @ApiAuthList({ description: 'Analytics returned', type: UserAnalyticsResponseDto })
  @ApiInternalError()
  getMyAnalytics(@CurrentUser('sub') userId: string): Promise<UserAnalyticsResponseDto> {
    return this.userApplicationService.getUserAnalytics(userId, userId);
  }

  @Patch('me')
  @ApiAuthUpdate({ description: 'Profile updated', type: UserMeResponseDto })
  updateMe(
    @CurrentUser('sub') userId: string,
    @Body() payload: UpdateMeDto,
  ): Promise<UserMeResponseDto> {
    return this.userApplicationService.updateProfile(userId, payload);
  }

  @Patch('me/settings')
  @ApiAuthUpdate({ description: 'Settings updated', type: UserMeResponseDto })
  updateMeSettings(
    @CurrentUser('sub') userId: string,
    @Body() payload: UpdateMeSettingsDto,
  ): Promise<UserMeResponseDto> {
    return this.userApplicationService.updateSettings(userId, payload);
  }
}
