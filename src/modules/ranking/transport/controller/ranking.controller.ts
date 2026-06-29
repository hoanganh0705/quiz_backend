/**
 * Ranking Controller
 *
 * API endpoints for leaderboards and user ranks.
 * Part of Phase 3 - Leaderboards & APIs.
 *
 * Error shape: ALL exceptions from this controller are intercepted by
 * `RankingDomainExceptionFilter` (via @UseFilters at the controller level).
 * Because the filter uses @Catch() with no argument, it catches EVERY
 * exception — including JwtGuard's UnauthorizedException, PermissionsGuard's
 * ForbiddenException, and class-validator's BadRequestException. All of
 * these are re-written to the same { statusCode, message, code, timestamp }
 * envelope, NOT the RFC 7807 ProblemDetailDto shape.
 */

import {
  Controller,
  Get,
  Param,
  Query,
  UseFilters,
  UseGuards,
  applyDecorators,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Public } from '@/common/decorators/public.decorator';
import { JwtGuard, type JwtPayload } from '@/common/guards/jwt.guard';
import { AUTH_SECURITY_NAME } from '@/core/swagger/swagger.config';
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
  LeaderboardResponseDto,
  UserRankResponseDto,
  UserRankSummaryDto,
  NearbyRanksResponseDto,
  PeakRanksResponseDto,
  RankingHistoryResponseDto,
  PublicRankingHistoryResponseDto,
  RankMovementResponseDto,
  RankingMilestonesResponseDto,
  TopMoversResponseDto,
  LeaderboardDistributionResponseDto,
  UserPercentileResponseDto,
} from '../../dto/response';
import {
  WrappedLeaderboardResponseDto,
  WrappedUserRankResponseDto,
  WrappedUserRankSummaryDto,
  WrappedNearbyRanksResponseDto,
  WrappedPeakRanksResponseDto,
  WrappedRankingHistoryResponseDto,
  WrappedPublicRankingHistoryResponseDto,
  WrappedRankMovementResponseDto,
  WrappedRankingMilestonesResponseDto,
  WrappedTopMoversResponseDto,
  WrappedLeaderboardDistributionResponseDto,
  WrappedUserPercentileResponseDto,
  RankingDomainErrorDto,
} from '../../dto/response';
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

// ─── Local helper decorators ───────────────────────────────────────────────────
//
// Every error from this controller is re-written by RankingDomainExceptionFilter
// into { statusCode, message, code, timestamp } — NOT RFC 7807 ProblemDetailDto.
// This is true even for JwtGuard's UnauthorizedException (caught by the filter,
// not by GlobalExceptionFilter).

/** 401 — JwtGuard blocks unauthenticated requests. */
function rankingUnauthorizedResponse(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(AUTH_SECURITY_NAME),
    ApiUnauthorizedResponse({
      description:
        'Missing or invalid JWT bearer token. ' +
        'JwtGuard throws `UnauthorizedException` which `RankingDomainExceptionFilter` ' +
        'catches and re-writes to a `{ statusCode, message, code, timestamp }` envelope ' +
        '(NOT RFC 7807 ProblemDetailDto).',
      schema: { $ref: getSchemaPath(RankingDomainErrorDto) },
    }),
  );
}

/** 403 — PermissionsGuard denies access. */
function rankingForbiddenResponse(): MethodDecorator {
  return applyDecorators(
    ApiForbiddenResponse({
      description:
        'Caller lacks the required permission role. ' +
        'PermissionsGuard throws `ForbiddenException` which `RankingDomainExceptionFilter` ' +
        'catches and re-writes to a `{ statusCode, message, code, timestamp }` envelope.',
      schema: { $ref: getSchemaPath(RankingDomainErrorDto) },
    }),
  );
}

/** 400 — validation errors (class-validator, date range checks). */
function rankingBadRequestResponse(): MethodDecorator {
  return applyDecorators(
    ApiBadRequestResponse({
      description:
        'Request validation failed (e.g. malformed query parameters, invalid date range). ' +
        '`BadRequestException` from validation is caught by `RankingDomainExceptionFilter` ' +
        'and re-written to a `{ statusCode, message, code, timestamp }` envelope.',
      schema: { $ref: getSchemaPath(RankingDomainErrorDto) },
    }),
  );
}

@ApiTags('leaderboard')
@ApiExtraModels(RankingDomainErrorDto)
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

  // ─── GET /leaderboard ─────────────────────────────────────────────────────
  //
  // Public endpoint — @Public() skips JwtGuard, so no 401 possible.
  // Only 400 (validation) and 500 (server errors) can occur.
  // No domain errors are thrown — this is a read-only cached leaderboard query.
  @Get()
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Get global leaderboard',
    description:
      'Returns the global leaderboard with optional period filter. ' +
      'Supports offset-based pagination via `limit` (1–500, default 100) and `offset`. ' +
      'The response includes the authenticated user\'s rank position if a valid JWT is provided. ' +
      'No 404 or 403 is possible on this endpoint.',
  })
  @ApiOkResponse({
    description: 'Leaderboard returned',
    type: WrappedLeaderboardResponseDto,
  })
  @rankingBadRequestResponse()
  async getGlobalLeaderboard(@Query() query: LeaderboardQueryDto): Promise<LeaderboardResponseDto> {
    return this.leaderboardService.getGlobalLeaderboard({
      period: query.period ?? RankingPeriodEnum.ALL_TIME,
      limit: query.limit ?? 100,
      offset: query.offset ?? 0,
    });
  }

  // ─── GET /leaderboard/distribution ─────────────────────────────────────────
  //
  // Public endpoint. No 401/403/404 possible. 400 from validation only.
  @Get('distribution')
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Get leaderboard distribution',
    description:
      'Returns distribution statistics for the active leaderboard in the selected period. ' +
      'Groups users into percentile buckets (Top 1%, Top 5%, etc.).',
  })
  @ApiOkResponse({
    description: 'Leaderboard distribution returned',
    type: WrappedLeaderboardDistributionResponseDto,
  })
  @rankingBadRequestResponse()
  async getLeaderboardDistribution(
    @Query() query: LeaderboardDistributionQueryDto,
  ): Promise<LeaderboardDistributionResponseDto> {
    return this.getLeaderboardDistributionQueryHandler.execute({
      period: mapRankingPeriodEnumToDomain(query.period ?? RankingPeriodEnum.ALL_TIME),
    });
  }

  // ─── GET /leaderboard/top-movers ───────────────────────────────────────────
  //
  // Public endpoint. No 401/403/404 possible. 400 from validation only.
  @Get('top-movers')
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Get top ranking movers',
    description:
      'Returns users with the largest positive ranking movement during the selected period. ' +
      'Results are sorted by `change` (previousRank - currentRank) descending.',
  })
  @ApiOkResponse({
    description: 'Top movers returned',
    type: WrappedTopMoversResponseDto,
  })
  @rankingBadRequestResponse()
  async getTopMovers(@Query() query: TopMoversQueryDto): Promise<TopMoversResponseDto> {
    return this.getTopMoversQueryHandler.execute({
      period: mapRankingPeriodEnumToDomain(query.period ?? RankingPeriodEnum.DAILY),
      limit: query.limit ?? 10,
    });
  }

  // ─── GET /leaderboard/me ──────────────────────────────────────────────────
  //
  // Protected by JwtGuard. No domain errors possible (builds empty response for
  // unknown users). 401 from JwtGuard. 400 not applicable (no query params).
  @Get('me')
  @UseGuards(JwtGuard)
  @rankingUnauthorizedResponse()
  @ApiOperation({
    summary: "Get current user's rank",
    description:
      "Returns the authenticated user's rank information across all periods (weekly, monthly, all-time), " +
      'peak ranks achieved, and activity badges. If the user has no ranking data, returns ' +
      'a "ghost" response with null ranks (no 404).',
  })
  @ApiOkResponse({
    description: 'User rank returned',
    type: WrappedUserRankResponseDto,
  })
  async getMyRank(@CurrentUser() user: JwtPayload): Promise<UserRankResponseDto> {
    return this.userRankService.getUserRank(user.sub);
  }

  // ─── GET /leaderboard/me/rank ────────────────────────────────────────────
  //
  // Protected by JwtGuard. Returns undefined if user has no rank in the period.
  // No 404/403 — undefined is returned for no-data, not an error.
  // 400 from query param validation.
  @Get('me/rank')
  @UseGuards(JwtGuard)
  @rankingUnauthorizedResponse()
  @ApiOperation({
    summary: "Get current user's rank for specific period",
    description:
      "Returns the authenticated user's rank summary for a specific period. " +
      "If the user has no XP in the requested period, returns `undefined` (HTTP 200, " +
      'no body data — the frontend should handle this nullability).',
  })
  @ApiOkResponse({
    description: 'User rank returned',
    type: WrappedUserRankSummaryDto,
  })
  @rankingBadRequestResponse()
  async getMyRankForPeriod(
    @Query() query: LeaderboardQueryDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<UserRankSummaryDto | undefined> {
    return this.userRankService.getUserRankForPeriod(
      user.sub,
      query.period ?? RankingPeriodEnum.ALL_TIME,
    );
  }

  // ─── GET /leaderboard/me/percentile ───────────────────────────────────────
  //
  // Protected by JwtGuard. Percentile calculation never throws.
  @Get('me/percentile')
  @UseGuards(JwtGuard)
  @rankingUnauthorizedResponse()
  @ApiOperation({
    summary: 'Get authenticated user percentile',
    description:
      'Returns the authenticated user\'s percentile ranking in the selected period. ' +
      'All fields are nullable — if the user has no rank, every field returns null. ' +
      'The percentile is calculated as `((totalUsers - rank) / totalUsers) * 100` rounded to 2 decimal places.',
  })
  @ApiOkResponse({
    description: 'User percentile returned',
    type: WrappedUserPercentileResponseDto,
  })
  @rankingBadRequestResponse()
  async getMyPercentile(
    @CurrentUser() user: JwtPayload,
    @Query() query: LeaderboardDistributionQueryDto,
  ): Promise<UserPercentileResponseDto> {
    return this.getMyPercentileQueryHandler.execute({
      userId: user.sub,
      period: mapRankingPeriodEnumToDomain(query.period ?? RankingPeriodEnum.ALL_TIME),
    });
  }

  // ─── GET /leaderboard/me/milestones ──────────────────────────────────────
  //
  // Protected by JwtGuard. Never throws.
  @Get('me/milestones')
  @UseGuards(JwtGuard)
  @rankingUnauthorizedResponse()
  @ApiOperation({
    summary: 'Get authenticated user ranking milestones',
    description:
      "Returns ranking milestones achieved by the authenticated user in chronological order. " +
      'A milestone is earned when the user reaches a specific rank threshold ' +
      '(e.g. TOP_100, TOP_10, TOP_1). Returns an empty `items` array if no milestones have been achieved.',
  })
  @ApiOkResponse({
    description: 'Ranking milestones returned',
    type: WrappedRankingMilestonesResponseDto,
  })
  async getMyRankingMilestones(
    @CurrentUser() user: JwtPayload,
  ): Promise<RankingMilestonesResponseDto> {
    return this.getMyRankingMilestonesQueryHandler.execute({
      userId: user.sub,
    });
  }

  // ─── GET /leaderboard/me/nearby ──────────────────────────────────────────
  //
  // Protected by JwtGuard. Never throws.
  @Get('me/nearby')
  @UseGuards(JwtGuard)
  @rankingUnauthorizedResponse()
  @ApiOperation({
    summary: 'Get nearby leaderboard ranks for authenticated user',
    description:
      'Returns leaderboard entries immediately above and below the authenticated user ' +
      'for the selected period. The `me` field contains the authenticated user\'s own entry. ' +
      'All three fields (`above`, `me`, `below`) can be empty arrays or null depending on position.',
  })
  @ApiOkResponse({
    description: 'Nearby ranks returned',
    type: WrappedNearbyRanksResponseDto,
  })
  @rankingBadRequestResponse()
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

  // ─── GET /leaderboard/me/movement ───────────────────────────────────────
  //
  // Protected by JwtGuard. 400 from date validation.
  @Get('me/movement')
  @UseGuards(JwtGuard)
  @rankingUnauthorizedResponse()
  @ApiOperation({
    summary: 'Get authenticated user rank movement',
    description:
      "Returns the authenticated user's ranking movement compared to the previous ranking snapshot. " +
      '`change` is computed as `previousRank - currentRank`. All fields are nullable — if the user ' +
      'has no current rank, returns nulls and `direction: "unknown"`.',
  })
  @ApiOkResponse({
    description: 'Rank movement returned',
    type: WrappedRankMovementResponseDto,
  })
  @rankingBadRequestResponse()
  async getMyRankMovement(
    @CurrentUser() user: JwtPayload,
    @Query() query: RankMovementQueryDto,
  ): Promise<RankMovementResponseDto> {
    return this.getMyRankMovementQueryHandler.execute({
      userId: user.sub,
      period: mapRankingPeriodEnumToDomain(query.period ?? RankingPeriodEnum.DAILY),
    });
  }

  // ─── GET /leaderboard/me/peak-ranks ────────────────────────────────────
  //
  // Protected by JwtGuard. Never throws.
  @Get('me/peak-ranks')
  @UseGuards(JwtGuard)
  @rankingUnauthorizedResponse()
  @ApiOperation({
    summary: "Get authenticated user's peak ranks",
    description:
      "Returns the authenticated user's best ranking positions ever achieved across all periods " +
      '(daily, weekly, monthly, all-time). Each period can be null if no rank was achieved.',
  })
  @ApiOkResponse({
    description: 'Peak ranks returned',
    type: WrappedPeakRanksResponseDto,
  })
  async getMyPeakRanks(@CurrentUser() user: JwtPayload): Promise<PeakRanksResponseDto> {
    return this.getMyPeakRanksQueryHandler.execute({
      userId: user.sub,
    });
  }

  // ─── GET /leaderboard/me/history ────────────────────────────────────────
  //
  // Protected by JwtGuard. 400 from date validation (from/to checks).
  @Get('me/history')
  @UseGuards(JwtGuard)
  @rankingUnauthorizedResponse()
  @ApiOperation({
    summary: "Get authenticated user's ranking history",
    description:
      "Returns the authenticated user's historical ranking progression over time. " +
      'Each entry is a daily snapshot `{ date, rank }`. Supports optional `from` and `to` ' +
      '(YYYY-MM-DD format) to filter the date range. 400 is returned if `from > to`.',
  })
  @ApiOkResponse({
    description: 'Ranking history returned',
    type: WrappedRankingHistoryResponseDto,
  })
  @rankingBadRequestResponse()
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

  // ─── GET /leaderboard/:userId ───────────────────────────────────────────
  //
  // Public endpoint. No 401/403/404. For unknown users, builds empty rank response.
  @Get(':userId')
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Get user rank information',
    description:
      "Returns public rank information for a specific user (all periods). " +
      "If the user has no ranking data, returns a ghost response with null ranks (no 404). " +
      'Unlike the `/leaderboard/me` endpoint, this is public and requires no authentication.',
  })
  @ApiOkResponse({
    description: 'User rank returned',
    type: WrappedUserRankResponseDto,
  })
  async getUserRank(@Param('userId') userId: string): Promise<UserRankResponseDto> {
    return this.userRankService.getUserRank(userId);
  }

  // ─── GET /leaderboard/:userId/history ─────────────────────────────────
  //
  // Public endpoint. 400 from date validation only.
  @Get(':userId/history')
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Get public user ranking history',
    description:
      "Returns the specified user's public historical ranking progression over time. " +
      'Publicly accessible (no authentication required). ' +
      'Supports optional `from` and `to` (YYYY-MM-DD) date filters. ' +
      '400 if `from > to`.',
  })
  @ApiOkResponse({
    description: 'Public ranking history returned',
    type: WrappedPublicRankingHistoryResponseDto,
  })
  @rankingBadRequestResponse()
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

  // ─── GET /leaderboard/:userId/rank ─────────────────────────────────────
  //
  // Public endpoint. Returns undefined for users with no rank in the period.
  @Get(':userId/rank')
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Get user rank for specific period',
    description:
      "Returns the user's public rank summary for a specific period. " +
      'Publicly accessible (no authentication required). ' +
      "If the user has no XP in the period, returns `undefined` (HTTP 200, no body).",
  })
  @ApiOkResponse({
    description: 'User rank returned',
    type: WrappedUserRankSummaryDto,
  })
  @rankingBadRequestResponse()
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
