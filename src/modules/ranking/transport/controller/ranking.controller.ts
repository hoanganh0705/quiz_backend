/**
 * Ranking Controller
 *
 * API endpoints for leaderboards and user ranks.
 * Part of Phase 3 - Leaderboards & APIs.
 */

import { Controller, Get, Param, Query, UseFilters, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Public } from '@/common/decorators/public.decorator';
import { JwtGuard, type JwtPayload } from '@/common/guards/jwt.guard';
import { ApiPublicList } from '@/common/swagger/swagger-decorators';
import { RankingDomainExceptionFilter } from '../filters/ranking-domain-exception.filter';
import { LeaderboardService } from '../../domain/services/leaderboard.service';
import { UserRankService } from '../../domain/services/user-rank.service';
import {
  LeaderboardQueryDto,
  LeaderboardDistributionQueryDto,
  MyRankingHistoryQueryDto,
  NearbyRanksQueryDto,
  RankMovementQueryDto,
  RankingPeriodEnum,
  TopMoversQueryDto,
} from '../../dto/request/leaderboard-query.dto';
import {
  LeaderboardDistributionResponseDto,
  LeaderboardResponseDto,
  NearbyRanksResponseDto,
  PeakRanksResponseDto,
  PublicRankingHistoryResponseDto,
  RankMovementResponseDto,
  RankingHistoryResponseDto,
  RankingMilestonesResponseDto,
  TopMoversResponseDto,
  UserPercentileResponseDto,
  UserRankResponseDto,
  UserRankSummaryDto,
} from '../../dto/response/leaderboard-response.dto';
import { GetLeaderboardDistributionQueryHandler } from '../../application/get-leaderboard-distribution.query';
import {
  GetMyRankingHistoryQueryHandler,
  mapRankingPeriodEnumToDomain,
} from '../../application/get-my-ranking-history.query';
import { GetMyPeakRanksQueryHandler } from '../../application/get-my-peak-ranks.query';
import { GetMyPercentileQueryHandler } from '../../application/get-my-percentile.query';
import { GetMyRankMovementQueryHandler } from '../../application/get-my-rank-movement.query';
import { GetMyRankingMilestonesQueryHandler } from '../../application/get-my-ranking-milestones.query';
import { GetNearbyRanksQueryHandler } from '../../application/get-nearby-ranks.query';
import { GetTopMoversQueryHandler } from '../../application/get-top-movers.query';
import { GetUserRankingHistoryQueryHandler } from '../../application/get-user-ranking-history.query';

@ApiTags('leaderboard')
@Controller('leaderboard')
@UseFilters(RankingDomainExceptionFilter)
export class RankingController {
  constructor(
    private readonly leaderboardService: LeaderboardService,
    private readonly userRankService: UserRankService,
    private readonly getLeaderboardDistributionQueryHandler: GetLeaderboardDistributionQueryHandler,
    private readonly getMyRankingHistoryQueryHandler: GetMyRankingHistoryQueryHandler,
    private readonly getMyPeakRanksQueryHandler: GetMyPeakRanksQueryHandler,
    private readonly getMyPercentileQueryHandler: GetMyPercentileQueryHandler,
    private readonly getMyRankMovementQueryHandler: GetMyRankMovementQueryHandler,
    private readonly getMyRankingMilestonesQueryHandler: GetMyRankingMilestonesQueryHandler,
    private readonly getNearbyRanksQueryHandler: GetNearbyRanksQueryHandler,
    private readonly getTopMoversQueryHandler: GetTopMoversQueryHandler,
    private readonly getUserRankingHistoryQueryHandler: GetUserRankingHistoryQueryHandler,
  ) {}

  @Get()
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Get global leaderboard',
    description: 'Returns the global leaderboard with optional period filter.',
  })
  @ApiPublicList({ description: 'Leaderboard returned', type: LeaderboardResponseDto })
  async getGlobalLeaderboard(@Query() query: LeaderboardQueryDto): Promise<LeaderboardResponseDto> {
    return this.leaderboardService.getGlobalLeaderboard({
      period: query.period ?? RankingPeriodEnum.ALL_TIME,
      limit: query.limit ?? 100,
      offset: query.offset ?? 0,
    });
  }

  @Get('distribution')
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Get leaderboard distribution',
    description:
      'Returns distribution statistics for the active leaderboard in the selected period.',
  })
  @ApiPublicList({
    description: 'Leaderboard distribution returned',
    type: LeaderboardDistributionResponseDto,
  })
  async getLeaderboardDistribution(
    @Query() query: LeaderboardDistributionQueryDto,
  ): Promise<LeaderboardDistributionResponseDto> {
    return this.getLeaderboardDistributionQueryHandler.execute({
      period: mapRankingPeriodEnumToDomain(query.period ?? RankingPeriodEnum.ALL_TIME),
    });
  }

  @Get('top-movers')
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Get top ranking movers',
    description:
      'Returns users with the largest positive ranking movement during the selected period.',
  })
  @ApiPublicList({ description: 'Top movers returned', type: TopMoversResponseDto })
  async getTopMovers(@Query() query: TopMoversQueryDto): Promise<TopMoversResponseDto> {
    return this.getTopMoversQueryHandler.execute({
      period: mapRankingPeriodEnumToDomain(query.period ?? RankingPeriodEnum.DAILY),
      limit: query.limit ?? 10,
    });
  }

  @Get('me')
  @UseGuards(JwtGuard)
  @ApiOperation({
    summary: 'Get current user rank',
    description: "Returns the authenticated user's rank information across all periods.",
  })
  @ApiOkResponse({ description: 'User rank returned', type: UserRankResponseDto })
  async getMyRank(@CurrentUser() user: JwtPayload): Promise<UserRankResponseDto> {
    return this.userRankService.getUserRank(user.sub);
  }

  @Get('me/rank')
  @UseGuards(JwtGuard)
  @ApiOperation({
    summary: 'Get current user rank for specific period',
    description: "Returns the authenticated user's rank for a specific period.",
  })
  @ApiOkResponse({ description: 'User rank returned', type: UserRankSummaryDto })
  async getMyRankForPeriod(
    @Query() query: LeaderboardQueryDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<UserRankSummaryDto | undefined> {
    return this.userRankService.getUserRankForPeriod(
      user.sub,
      query.period ?? RankingPeriodEnum.ALL_TIME,
    );
  }

  @Get('me/percentile')
  @UseGuards(JwtGuard)
  @ApiOperation({
    summary: 'Get authenticated user percentile',
    description: 'Returns the authenticated user percentile in the selected leaderboard period.',
  })
  @ApiOkResponse({ description: 'User percentile returned', type: UserPercentileResponseDto })
  async getMyPercentile(
    @CurrentUser() user: JwtPayload,
    @Query() query: LeaderboardDistributionQueryDto,
  ): Promise<UserPercentileResponseDto> {
    return this.getMyPercentileQueryHandler.execute({
      userId: user.sub,
      period: mapRankingPeriodEnumToDomain(query.period ?? RankingPeriodEnum.ALL_TIME),
    });
  }

  @Get('me/milestones')
  @UseGuards(JwtGuard)
  @ApiOperation({
    summary: 'Get authenticated user ranking milestones',
    description:
      'Returns ranking milestones achieved by the authenticated user in chronological order.',
  })
  @ApiOkResponse({ description: 'Ranking milestones returned', type: RankingMilestonesResponseDto })
  async getMyRankingMilestones(
    @CurrentUser() user: JwtPayload,
  ): Promise<RankingMilestonesResponseDto> {
    return this.getMyRankingMilestonesQueryHandler.execute({
      userId: user.sub,
    });
  }

  @Get('me/nearby')
  @UseGuards(JwtGuard)
  @ApiOperation({
    summary: 'Get nearby leaderboard ranks for authenticated user',
    description: 'Returns leaderboard entries immediately above and below the authenticated user.',
  })
  @ApiOkResponse({ description: 'Nearby ranks returned', type: NearbyRanksResponseDto })
  async getNearbyRanks(
    @CurrentUser() user: JwtPayload,
    @Query() query: NearbyRanksQueryDto,
  ): Promise<NearbyRanksResponseDto> {
    return this.getNearbyRanksQueryHandler.execute({
      userId: user.sub,
      period: mapRankingPeriodEnumToDomain(query.period ?? RankingPeriodEnum.ALL_TIME),
      radius: query.radius ?? 2,
    });
  }

  @Get('me/movement')
  @UseGuards(JwtGuard)
  @ApiOperation({
    summary: 'Get authenticated user rank movement',
    description:
      "Returns the authenticated user's ranking movement compared to the previous ranking snapshot.",
  })
  @ApiOkResponse({ description: 'Rank movement returned', type: RankMovementResponseDto })
  async getMyRankMovement(
    @CurrentUser() user: JwtPayload,
    @Query() query: RankMovementQueryDto,
  ): Promise<RankMovementResponseDto> {
    return this.getMyRankMovementQueryHandler.execute({
      userId: user.sub,
      period: mapRankingPeriodEnumToDomain(query.period ?? RankingPeriodEnum.DAILY),
    });
  }

  @Get('me/peak-ranks')
  @UseGuards(JwtGuard)
  @ApiOperation({
    summary: 'Get authenticated user peak ranks',
    description: "Returns the authenticated user's best ranking positions ever achieved.",
  })
  @ApiOkResponse({ description: 'Peak ranks returned', type: PeakRanksResponseDto })
  async getMyPeakRanks(@CurrentUser() user: JwtPayload): Promise<PeakRanksResponseDto> {
    return this.getMyPeakRanksQueryHandler.execute({
      userId: user.sub,
    });
  }

  @Get('me/history')
  @UseGuards(JwtGuard)
  @ApiOperation({
    summary: 'Get authenticated user ranking history',
    description: "Returns the authenticated user's historical ranking progression over time.",
  })
  @ApiOkResponse({ description: 'Ranking history returned', type: RankingHistoryResponseDto })
  async getMyRankingHistory(
    @CurrentUser() user: JwtPayload,
    @Query() query: MyRankingHistoryQueryDto,
  ): Promise<RankingHistoryResponseDto> {
    return this.getMyRankingHistoryQueryHandler.execute({
      userId: user.sub,
      period: mapRankingPeriodEnumToDomain(query.period ?? RankingPeriodEnum.ALL_TIME),
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    });
  }

  @Get(':userId')
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Get user rank information',
    description: 'Returns public rank information for a specific user.',
  })
  @ApiPublicList({ description: 'User rank returned', type: UserRankResponseDto })
  async getUserRank(@Param('userId') userId: string): Promise<UserRankResponseDto> {
    return this.userRankService.getUserRank(userId);
  }

  @Get(':userId/history')
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Get public user ranking history',
    description: "Returns the specified user's public historical ranking progression over time.",
  })
  @ApiPublicList({
    description: 'Public ranking history returned',
    type: PublicRankingHistoryResponseDto,
  })
  async getUserRankingHistory(
    @Param('userId') userId: string,
    @Query() query: MyRankingHistoryQueryDto,
  ): Promise<PublicRankingHistoryResponseDto> {
    return this.getUserRankingHistoryQueryHandler.execute({
      targetUserId: userId,
      period: mapRankingPeriodEnumToDomain(query.period ?? RankingPeriodEnum.ALL_TIME),
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    });
  }

  @Get(':userId/rank')
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Get user rank for specific period',
    description: "Returns the user's rank for a specific period.",
  })
  @ApiPublicList({ description: 'User rank returned', type: UserRankSummaryDto })
  async getUserRankForPeriod(
    @Param('userId') userId: string,
    @Query() query: LeaderboardQueryDto,
  ): Promise<UserRankSummaryDto | undefined> {
    return this.userRankService.getUserRankForPeriod(
      userId,
      query.period ?? RankingPeriodEnum.ALL_TIME,
    );
  }
}
