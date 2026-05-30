/**
 * Ranking Controller
 *
 * API endpoints for leaderboards and user ranks.
 * Part of Phase 3 - Leaderboards & APIs.
 */

import { Controller, Get, Param, Query, UseFilters, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiBearerAuth,
  ApiUnauthorizedResponse,
  ApiNotFoundResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Public } from '@/common/decorators/public.decorator';
import { JwtGuard, type JwtPayload } from '@/common/guards/jwt.guard';
import { RankingDomainExceptionFilter } from '../filters/ranking-domain-exception.filter';
import { LeaderboardService } from '../../domain/services/leaderboard.service';
import { UserRankService } from '../../domain/services/user-rank.service';
import { LeaderboardQueryDto, RankingPeriodEnum } from '../../dto/request/leaderboard-query.dto';
import {
  LeaderboardResponseDto,
  UserRankResponseDto,
  UserRankSummaryDto,
} from '../../dto/response/leaderboard-response.dto';

@ApiTags('leaderboard')
@Controller('leaderboard')
@UseFilters(RankingDomainExceptionFilter)
export class RankingController {
  constructor(
    private readonly leaderboardService: LeaderboardService,
    private readonly userRankService: UserRankService,
  ) {}

  @Get()
  @Public()
  @ApiOperation({
    summary: 'Get global leaderboard',
    description: 'Returns the global leaderboard with optional period filter.',
  })
  @ApiOkResponse({ description: 'Leaderboard returned', type: LeaderboardResponseDto })
  @ApiQuery({ name: 'period', enum: RankingPeriodEnum, required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async getGlobalLeaderboard(@Query() query: LeaderboardQueryDto): Promise<LeaderboardResponseDto> {
    return this.leaderboardService.getGlobalLeaderboard({
      period: query.period ?? RankingPeriodEnum.ALL_TIME,
      limit: query.limit ?? 100,
      offset: query.offset ?? 0,
    });
  }

  @Get('me')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get current user rank',
    description: "Returns the authenticated user's rank information across all periods.",
  })
  @ApiOkResponse({ description: 'User rank returned', type: UserRankResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid token' })
  async getMyRank(@CurrentUser() user: JwtPayload): Promise<UserRankResponseDto> {
    return this.userRankService.getUserRank(user.sub);
  }

  @Get('me/rank')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get current user rank for specific period',
    description: "Returns the authenticated user's rank for a specific period.",
  })
  @ApiOkResponse({ description: 'User rank returned', type: UserRankSummaryDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid token' })
  @ApiNotFoundResponse({ description: 'User not found or has no rank' })
  @ApiQuery({ name: 'period', enum: RankingPeriodEnum, required: false })
  async getMyRankForPeriod(
    @Query() query: LeaderboardQueryDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<UserRankSummaryDto | undefined> {
    return this.userRankService.getUserRankForPeriod(
      user.sub,
      query.period ?? RankingPeriodEnum.ALL_TIME,
    );
  }

  @Get(':userId')
  @Public()
  @ApiOperation({
    summary: 'Get user rank information',
    description: 'Returns public rank information for a specific user.',
  })
  @ApiOkResponse({ description: 'User rank returned', type: UserRankResponseDto })
  @ApiNotFoundResponse({ description: 'User not found' })
  async getUserRank(@Param('userId') userId: string): Promise<UserRankResponseDto> {
    return this.userRankService.getUserRank(userId);
  }

  @Get(':userId/rank')
  @Public()
  @ApiOperation({
    summary: 'Get user rank for specific period',
    description: "Returns the user's rank for a specific period.",
  })
  @ApiOkResponse({ description: 'User rank returned', type: UserRankSummaryDto })
  @ApiNotFoundResponse({ description: 'User not found or has no rank' })
  @ApiQuery({ name: 'period', enum: RankingPeriodEnum, required: false })
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
