import { Body, Controller, Get, Inject, Param, Patch, Query, UseFilters } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  type ApiResponseOptions,
} from '@nestjs/swagger';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { ApiAuth } from '@/common/swagger/swagger-decorators';
import { ProblemDetailDto, ErrorResponseExamples } from '@/common/swagger/swagger-schemas';
import { RecommendedQuizzesQueryDto } from '@/modules/quiz/dto/request/recommended-quizzes-query.dto';
import { ListQuizzesQueryDto } from '@/modules/quiz/dto/request/list-quizzes-query.dto';
import { ListUserActivityQueryDto } from '../../dto/request/list-user-activity-query.dto';
import { GetMyTournamentsQueryDto } from '../../dto/request/get-my-tournaments-query.dto';
import { GetMyTournamentHistoryQueryDto } from '../../dto/request/get-my-tournament-history-query.dto';
import { UpdateMeSettingsDto } from '../../dto/request/update-me-settings.dto';
import { UpdateMeDto } from '../../dto/request/update-me.dto';
import { ListUserBadgesQueryDto } from '../../dto/request/list-user-badges-query.dto';
import { UserMeResponseDto } from '../../dto/response/user-me.dto';
import { UserBadgesResponseDto } from '../../dto/response/user-badges.dto';
import { UserActivityResponseDto } from '../../dto/response/user-activity.dto';
import { UserRankingResponseDto } from '../../dto/response/user-ranking.dto';
import { UserAnalyticsResponseDto } from '../../dto/response/user-analytics.dto';
import { MyTournamentsResponseDto } from '../../dto/response/my-tournaments.dto';
import { MyTournamentHistoryResponseDto } from '../../dto/response/my-tournament-history.dto';
import { MyTournamentAnalyticsResponseDto } from '../../dto/response/my-tournament-analytics.dto';
import { PublicTournamentProfileResponseDto } from '../../dto/response/public-tournament-profile.dto';
import { UserApplicationService } from '../../application/user.application.service';
import { UserDomainExceptionFilter } from '../filters/user-domain-exception.filter';
import { QUIZ_LISTING_PORT, type QuizListingPort } from '@/modules/quiz/domain/analytics';
import {
  UserWrappedActivityDto,
  UserWrappedAnalyticsDto,
  UserWrappedBadgesDto,
  UserWrappedCreatorAnalyticsDto,
  UserWrappedMeDto,
  UserWrappedMyTournamentAnalyticsDto,
  UserWrappedMyTournamentHistoryDto,
  UserWrappedMyTournamentsDto,
  UserWrappedPublicTournamentProfileDto,
  UserWrappedRankingDto,
  UserWrappedRelatedQuizzesDto,
  UserWrappedUserQuizzesDto,
} from '../../dto/response/user-response-docs.dto';

const badRequestOptions = {
  description: 'Request body, query, or params failed validation',
  type: ProblemDetailDto,
  example: ErrorResponseExamples.badRequest,
};
const notFoundOptions = {
  description: 'The requested user or resource does not exist',
  type: ProblemDetailDto,
  example: ErrorResponseExamples.notFound,
};
const forbiddenOptions = {
  description: 'The profile is private and cannot be accessed',
  type: ProblemDetailDto,
  example: ErrorResponseExamples.forbidden,
};
const internalErrorOptions = {
  description: 'Unexpected server error',
  type: ProblemDetailDto,
  example: ErrorResponseExamples.internalServerError,
};

/**
 * Convenience alias that lets us pass `example` alongside `type` directly
 * (NestJS Swagger's ResponseObjectMapper only picks up `example` placed at the
 * top level of `ApiResponseOptions`).
 */
const ApiOk = (options: ApiResponseOptions): MethodDecorator => ApiOkResponse(options);

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
  @ApiOk({
    description: 'Recommended quizzes returned',
    type: UserWrappedRelatedQuizzesDto,
    example: {
      data: {
        items: [
          {
            quizId: '660e8400-e29b-41d4-a716-446655440000',
            title: 'JavaScript Fundamentals',
            slug: 'javascript-fundamentals',
            imageUrl: 'https://example.com/covers/js.png',
          },
        ],
      },
      meta: { timestamp: '2026-06-25T10:30:00.000Z' },
    },
  })
  @ApiInternalServerErrorResponse(internalErrorOptions)
  getRecommendedQuizzes(
    @CurrentUser('sub') userId: string,
    @Query() query: RecommendedQuizzesQueryDto,
  ): Promise<unknown> {
    return this.quizListing.getRecommendedQuizzes(userId, query);
  }

  @Get(':userId/quizzes/analytics')
  @ApiOperation({
    summary: 'Get creator analytics for a user',
    description: 'Returns aggregate creator-side quiz analytics for the given user.',
  })
  @ApiOk({
    description: 'Quiz analytics returned',
    type: UserWrappedCreatorAnalyticsDto,
    example: {
      data: {
        userId: '550e8400-e29b-41d4-a716-446655440000',
        totalQuizzes: 12,
        draftQuizzes: 3,
        publishedQuizzes: 9,
        totalAttempts: 4800,
        totalPlayers: 2900,
        averageScore: 76.4,
        averageRating: 4.4,
        totalBookmarks: 510,
        totalReviews: 310,
        lastUpdated: '2026-06-01T00:00:00.000Z',
      },
      meta: { timestamp: '2026-06-25T10:30:00.000Z' },
    },
  })
  @ApiNotFoundResponse(notFoundOptions)
  @ApiInternalServerErrorResponse(internalErrorOptions)
  getUserQuizAnalytics(@Param('userId') userId: string): Promise<unknown> {
    return this.quizListing.getMyQuizAnalytics(userId);
  }

  @Get(':userId/quizzes')
  @ApiOperation({
    summary: 'List quizzes created by a user',
    description: 'Returns a cursor-paginated list of quizzes created by the specified user.',
  })
  @ApiOk({
    description: 'Quizzes returned',
    type: UserWrappedUserQuizzesDto,
    example: {
      data: [
        {
          quizId: '660e8400-e29b-41d4-a716-446655440000',
          title: 'JavaScript Fundamentals',
          slug: 'javascript-fundamentals',
          imageUrl: 'https://example.com/covers/js.png',
        },
      ],
      meta: {
        timestamp: '2026-06-25T10:30:00.000Z',
        pagination: {
          limit: 20,
          hasNextPage: true,
          nextCursor: 'eyJjcmVhdGVkQXQiOiIyMDI2LTAxLTAxVDAwOjAwOjAwWiJ9',
        },
      },
    },
  })
  @ApiNotFoundResponse(notFoundOptions)
  @ApiBadRequestResponse(badRequestOptions)
  @ApiInternalServerErrorResponse(internalErrorOptions)
  listUserQuizzes(
    @Param('userId') userId: string,
    @Query() query: ListQuizzesQueryDto,
  ): Promise<unknown> {
    return this.quizListing.listQuizzesByCreator(userId, query);
  }

  @Get(':userId/badges')
  @ApiOperation({
    summary: 'List badges earned by a user',
    description:
      "Returns a cursor-paginated list of badges earned by the specified user. Honours the user's privacy settings — private profiles return 403.",
  })
  @ApiOk({
    description: 'Badges returned',
    type: UserWrappedBadgesDto,
    example: {
      data: [
        {
          badgeId: 'b9d6f3a0-7d6e-4d6c-b4d2-1a4f6b2aef90',
          name: 'Quiz Master',
          description: 'Earned by completing 100 quizzes with a score above 90%.',
          earnedAt: '2026-05-12T14:18:00.000Z',
        },
      ],
      meta: {
        timestamp: '2026-06-25T10:30:00.000Z',
        pagination: { limit: 10, hasNextPage: false, nextCursor: null },
      },
    },
  })
  @ApiNotFoundResponse(notFoundOptions)
  @ApiForbiddenResponse(forbiddenOptions)
  @ApiBadRequestResponse(badRequestOptions)
  @ApiInternalServerErrorResponse(internalErrorOptions)
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
  @ApiOk({
    description: 'Profile returned',
    type: UserWrappedMeDto,
    example: {
      data: {
        userId: '550e8400-e29b-41d4-a716-446655440000',
        username: 'alice_wonder',
        email: 'alice@example.com',
        displayName: 'Alice',
        avatarUrl: 'https://example.com/avatars/alice.jpg',
        bio: 'Quiz enthusiast',
        xpTotal: 15420,
        currentStreak: 7,
        longestStreak: 14,
        settings: { theme: 'dark', notifications: true },
        createdAt: '2025-01-15T08:30:00.000Z',
        updatedAt: '2025-06-01T12:00:00.000Z',
      },
      meta: { timestamp: '2026-06-25T10:30:00.000Z' },
    },
  })
  @ApiInternalServerErrorResponse(internalErrorOptions)
  me(@CurrentUser('sub') userId: string): Promise<UserMeResponseDto> {
    return this.userApplicationService.getMe(userId);
  }

  @Get('me/badges')
  @ApiAuth()
  @ApiOperation({
    summary: 'List my earned badges',
    description: 'Returns a cursor-paginated list of badges earned by the authenticated user.',
  })
  @ApiOk({
    description: 'Badges returned',
    type: UserWrappedBadgesDto,
    example: {
      data: [
        {
          badgeId: 'b9d6f3a0-7d6e-4d6c-b4d2-1a4f6b2aef90',
          name: 'Quiz Master',
          description: 'Earned by completing 100 quizzes with a score above 90%.',
          earnedAt: '2026-05-12T14:18:00.000Z',
        },
      ],
      meta: {
        timestamp: '2026-06-25T10:30:00.000Z',
        pagination: { limit: 10, hasNextPage: false, nextCursor: null },
      },
    },
  })
  @ApiBadRequestResponse(badRequestOptions)
  @ApiInternalServerErrorResponse(internalErrorOptions)
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
  @ApiOk({
    description: 'Activity returned',
    type: UserWrappedActivityDto,
    example: {
      data: [
        {
          eventId: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
          eventType: 'attempt_completed',
          createdAt: '2026-06-25T10:30:00.000Z',
          metadata: { quizId: '660e8400-e29b-41d4-a716-446655440000', score: 88 },
        },
      ],
      meta: {
        timestamp: '2026-06-25T10:30:00.000Z',
        pagination: {
          limit: 20,
          hasNextPage: true,
          nextCursor: 'eyJjcmVhdGVkQXQiOiIyMDI2LTAxLTAxVDAwOjAwOjAwWiIsImV2ZW50SWQiOiJ1dWlkIn0',
        },
      },
    },
  })
  @ApiBadRequestResponse(badRequestOptions)
  @ApiInternalServerErrorResponse(internalErrorOptions)
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
  @ApiOk({
    description: 'Tournament history returned',
    type: UserWrappedMyTournamentHistoryDto,
    example: {
      data: [
        {
          tournamentId: '660e8400-e29b-41d4-a716-446655440000',
          tournamentName: 'Spring Challenge',
          rank: 12,
          score: 540,
          participantCount: 523,
          completedAt: '2026-06-01T00:00:00.000Z',
        },
      ],
      meta: {
        timestamp: '2026-06-25T10:30:00.000Z',
        pagination: { limit: 20, hasNextPage: false, nextCursor: null },
      },
    },
  })
  @ApiNotFoundResponse(notFoundOptions)
  @ApiForbiddenResponse(forbiddenOptions)
  @ApiBadRequestResponse(badRequestOptions)
  @ApiInternalServerErrorResponse(internalErrorOptions)
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
  @ApiOk({
    description: 'Tournament profile returned',
    type: UserWrappedPublicTournamentProfileDto,
    example: {
      data: {
        userId: '550e8400-e29b-41d4-a716-446655440000',
        tournamentsPlayed: 32,
        tournamentsWon: 4,
        bestRank: 1,
        averageRank: 18,
        top10Finishes: 12,
        totalTournamentScore: 15420,
        lastTournamentAt: '2026-06-01T00:00:00.000Z',
      },
      meta: { timestamp: '2026-06-25T10:30:00.000Z' },
    },
  })
  @ApiNotFoundResponse(notFoundOptions)
  @ApiForbiddenResponse(forbiddenOptions)
  @ApiInternalServerErrorResponse(internalErrorOptions)
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
  @ApiOk({
    description: 'My tournaments returned',
    type: UserWrappedMyTournamentsDto,
    example: {
      data: [
        {
          tournamentId: '660e8400-e29b-41d4-a716-446655440000',
          name: 'Spring Challenge',
          status: 'upcoming',
          registeredAt: '2026-06-01T00:00:00.000Z',
          startAt: '2026-06-05T00:00:00.000Z',
          endAt: '2026-06-10T00:00:00.000Z',
        },
      ],
      meta: {
        timestamp: '2026-06-25T10:30:00.000Z',
        pagination: {
          limit: 20,
          hasNextPage: true,
          nextCursor:
            'eyJyZWdpc3RlcmVkQXQiOiAiMjAyNi0wNi0wMVQwMDowMDowMFoiLCAicGFydGljaXBhbnRJZCI6ICI2NjBlODQwMC1lMjliLTMxZDQtYTcxNi00NDY2NTY1NDQwMDAifQ==',
        },
      },
    },
  })
  @ApiBadRequestResponse(badRequestOptions)
  @ApiInternalServerErrorResponse(internalErrorOptions)
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
  @ApiOk({
    description: 'My tournament history returned',
    type: UserWrappedMyTournamentHistoryDto,
    example: {
      data: [
        {
          tournamentId: '660e8400-e29b-41d4-a716-446655440000',
          tournamentName: 'Spring Challenge',
          rank: 12,
          score: 540,
          participantCount: 523,
          completedAt: '2026-06-01T00:00:00.000Z',
        },
      ],
      meta: {
        timestamp: '2026-06-25T10:30:00.000Z',
        pagination: { limit: 20, hasNextPage: false, nextCursor: null },
      },
    },
  })
  @ApiBadRequestResponse(badRequestOptions)
  @ApiInternalServerErrorResponse(internalErrorOptions)
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
  @ApiOk({
    description: 'Tournament analytics returned',
    type: UserWrappedMyTournamentAnalyticsDto,
    example: {
      data: {
        tournamentsPlayed: 45,
        wins: 6,
        top3Finishes: 11,
        top10Finishes: 18,
        averageRank: 21,
        bestRank: 1,
        averageScore: 84,
        totalTournamentScore: 12540,
        completionRate: 91,
        lastTournamentAt: '2026-06-01T00:00:00.000Z',
      },
      meta: { timestamp: '2026-06-25T10:30:00.000Z' },
    },
  })
  @ApiInternalServerErrorResponse(internalErrorOptions)
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
  @ApiOk({
    description: 'Ranking returned',
    type: UserWrappedRankingDto,
    example: {
      data: {
        userId: '550e8400-e29b-41d4-a716-446655440000',
        globalRank: 42,
        totalScore: 15420,
        level: 14,
        updatedAt: '2026-06-25T10:30:00.000Z',
      },
      meta: { timestamp: '2026-06-25T10:30:00.000Z' },
    },
  })
  @ApiInternalServerErrorResponse(internalErrorOptions)
  getMyRanking(@CurrentUser('sub') userId: string): Promise<UserRankingResponseDto> {
    return this.userApplicationService.getUserRanking(userId, userId);
  }

  @Get('me/analytics')
  @ApiAuth()
  @ApiOperation({
    summary: 'Get my analytics',
    description: "Returns the authenticated user's aggregate analytics summary.",
  })
  @ApiOk({
    description: 'Analytics returned',
    type: UserWrappedAnalyticsDto,
    example: {
      data: {
        userId: '550e8400-e29b-41d4-a716-446655440000',
        summary: { totalAttempts: 420, completedQuizzes: 310, averageScore: 83.5 },
        favoriteCategory: { categoryId: '660e8400-e29b-41d4-a716-446655440000', name: 'Science' },
        favoriteTag: { tagId: '770e8400-e29b-41d4-a716-446655440111', name: 'Physics' },
        lastUpdated: '2026-06-05T01:00:00.000Z',
      },
      meta: { timestamp: '2026-06-25T10:30:00.000Z' },
    },
  })
  @ApiInternalServerErrorResponse(internalErrorOptions)
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
  @ApiOk({
    description: 'Profile updated',
    type: UserWrappedMeDto,
    example: {
      data: {
        userId: '550e8400-e29b-41d4-a716-446655440000',
        username: 'alice_wonder',
        email: 'alice@example.com',
        displayName: 'Alice',
        avatarUrl: 'https://example.com/avatars/alice.jpg',
        bio: 'Quiz enthusiast and trivia lover',
        xpTotal: 15420,
        currentStreak: 7,
        longestStreak: 14,
        settings: { theme: 'dark', notifications: true },
        createdAt: '2025-01-15T08:30:00.000Z',
        updatedAt: '2026-06-25T10:30:00.000Z',
      },
      meta: { timestamp: '2026-06-25T10:30:00.000Z' },
    },
  })
  @ApiBadRequestResponse(badRequestOptions)
  @ApiInternalServerErrorResponse(internalErrorOptions)
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
  @ApiOk({
    description: 'Settings updated',
    type: UserWrappedMeDto,
    example: {
      data: {
        userId: '550e8400-e29b-41d4-a716-446655440000',
        username: 'alice_wonder',
        email: 'alice@example.com',
        displayName: 'Alice',
        avatarUrl: 'https://example.com/avatars/alice.jpg',
        bio: 'Quiz enthusiast',
        xpTotal: 15420,
        currentStreak: 7,
        longestStreak: 14,
        settings: { theme: 'light', notifications: false, language: 'vi' },
        createdAt: '2025-01-15T08:30:00.000Z',
        updatedAt: '2026-06-25T10:30:00.000Z',
      },
      meta: { timestamp: '2026-06-25T10:30:00.000Z' },
    },
  })
  @ApiBadRequestResponse(badRequestOptions)
  @ApiInternalServerErrorResponse(internalErrorOptions)
  updateMeSettings(
    @CurrentUser('sub') userId: string,
    @Body() payload: UpdateMeSettingsDto,
  ): Promise<UserMeResponseDto> {
    return this.userApplicationService.updateSettings(userId, payload);
  }
}
