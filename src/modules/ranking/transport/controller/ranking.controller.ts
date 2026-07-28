/**
 * Ranking Controller
 *
 * API endpoints for leaderboards and user ranks.
 * Part of Phase 3 - Leaderboards & APIs.
 *
 * Error shape: All error responses (RFC 7807 `ProblemDetailDto`) are
 * produced by `GlobalExceptionFilter` after Phase 3.2. The prior
 * `RankingDomainExceptionFilter` (a `@Catch()` catch-all that
 * shadowed the global filter) has been removed. The
 * `RankingDomainErrorDto` is also gone — see the plan §8.4.2
 * completion criterion.
 */

import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
  applyDecorators,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Public } from '@/common/decorators/public.decorator';
import { JwtGuard, type JwtPayload } from '@/common/guards/jwt.guard';
import { ErrorResponseExamples, ProblemDetailDto } from '@/common/swagger/swagger-schemas';
import { AUTH_SECURITY_NAME } from '@/core/swagger/swagger.config';
import { LeaderboardService } from '../../domain/services/leaderboard.service';
import { UserRankService } from '../../domain/services/user-rank.service';
import {
  LeaderboardPeriodEnum,
  LeaderboardQueryDto,
  LeaderboardDistributionQueryDto,
  MyRankingHistoryQueryDto,
  NearbyRanksQueryDto,
  RankMovementQueryDto,
  RankingPeriodEnum,
  TopMoversQueryDto,
  TopMoversPeriodEnum,
  mapTopMoversPeriodEnumToDomain,
} from '../../dto/request/leaderboard-query.dto';
import {
  LeaderboardResponseDto,
  UserRankResponseDto,
  UserRankSummaryDto,
  NearbyRanksResponseDto,
  PeakRanksResponseDto,
  PublicRankingHistoryResponseDto,
  RankMovementResponseDto,
  LeaderboardDistributionResponseDto,
  UserPercentileResponseDto,
  RankingMilestoneDto,
  TopMoverDto,
  RankingHistoryItemDto,
} from '../../dto/response';
import { RankingPresenter } from '../presenters/ranking.presenter';
import { ApiOkResource, ApiOkResourceArray } from '@/common/swagger/api-ok';
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
// All error responses (401 from JwtGuard, 400 from class-validator /
// date-range validation, 404 from cross-module UserNotFoundError, 500
// from `InvalidXpEventError`/`RankCalculationError`/`PeriodResetError`)
// are routed through `GlobalExceptionFilter` as RFC 7807
// `ProblemDetailDto` after Phase 3.2.

/** 401 — JwtGuard blocks unauthenticated requests. */
function rankingUnauthorizedResponse(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(AUTH_SECURITY_NAME),
    ApiUnauthorizedResponse({
      description:
        'Missing or invalid JWT bearer token. ' +
        'JwtGuard throws `UnauthorizedException` which `GlobalExceptionFilter` ' +
        'emits as RFC 7807 `ProblemDetailDto` (NOT the legacy ranking ' +
        '`{ statusCode, message, code, timestamp }` envelope).',
      type: ProblemDetailDto,
      example: ErrorResponseExamples.unauthorized,
    }),
  );
}

/** 400 — validation errors (class-validator, date range checks). */
function rankingBadRequestResponse(): MethodDecorator {
  return applyDecorators(
    ApiBadRequestResponse({
      description:
        'Request validation failed (e.g. malformed query parameters, invalid date range). ' +
        '`BadRequestException` from validation is caught by `GlobalExceptionFilter` ' +
        'and emitted as RFC 7807 `ProblemDetailDto`.',
      type: ProblemDetailDto,
      example: ErrorResponseExamples.badRequest,
    }),
  );
}

/**
 * Documents a UUID path parameter and feeds it through `ParseUUIDPipe`.
 *
 * Without this, a value like `/leaderboard/not-a-uuid` reached the SQL layer
 * and produced a 500 (`invalid input syntax for type uuid`). The pipe turns
 * it into a 400 at the boundary, and the `@ApiParam` annotation teaches
 * generated SDKs / Swagger UI to render `format: uuid` on the parameter
 * (see audit L-02).
 */
function rankingUserIdParam(): MethodDecorator {
  return applyDecorators(
    ApiParam({
      name: 'userId',
      format: 'uuid',
      required: true,
      description: 'User identifier (UUIDv7).',
    }),
  );
}

@ApiTags('leaderboards')
@Controller('leaderboard')
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
    private readonly presenter: RankingPresenter,
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
      'No 404 or 403 is possible on this endpoint. ' +
      'Note: `userPosition` is always `null` on this public variant.',
  })
  @ApiOkResource(LeaderboardResponseDto, { description: 'Leaderboard returned' })
  @rankingBadRequestResponse()
  async getGlobalLeaderboard(@Query() query: LeaderboardQueryDto) {
    const result = await this.leaderboardService.getGlobalLeaderboard({
      period: query.period ?? RankingPeriodEnum.ALL_TIME,
      limit: query.limit ?? 100,
      offset: query.offset ?? 0,
    });
    return this.presenter.getGlobalLeaderboard(result);
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
      'Groups users into percentile buckets (Top 1%, Top 5%, etc.). ' +
      'Public endpoint — accessible without authentication.',
  })
  @ApiOkResource(LeaderboardDistributionResponseDto, {
    description: 'Leaderboard distribution returned',
  })
  @rankingBadRequestResponse()
  async getLeaderboardDistribution(@Query() query: LeaderboardDistributionQueryDto) {
    const result = await this.getLeaderboardDistributionQueryHandler.execute({
      period: mapRankingPeriodEnumToDomain(query.period ?? RankingPeriodEnum.ALL_TIME),
    });
    return this.presenter.getLeaderboardDistribution(result);
  }

  // ─── GET /leaderboard/top-movers ───────────────────────────────────────────
  //
  // Public endpoint. No 401/403/404 possible. 400 from validation only.
  // The application returns `{ items }`; the presenter unwraps to a bare array.
  @Get('top-movers')
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Get top ranking movers',
    description:
      'Returns users with the largest positive ranking movement during the selected period. ' +
      'Results are sorted by `change` (previousRank - currentRank) descending.',
  })
  @ApiOkResourceArray(TopMoverDto, { description: 'Top movers returned' })
  @rankingBadRequestResponse()
  async getTopMovers(@Query() query: TopMoversQueryDto) {
    const result = await this.getTopMoversQueryHandler.execute({
      period: mapTopMoversPeriodEnumToDomain(query.period ?? TopMoversPeriodEnum.WEEKLY),
      limit: query.limit ?? 10,
    });
    return this.presenter.getTopMovers(result);
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
  @ApiOkResource(UserRankResponseDto, { description: 'User rank returned' })
  async getMyRank(@CurrentUser() user: JwtPayload) {
    const result = await this.userRankService.getUserRank(user.sub);
    return this.presenter.getMyRank(result);
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
      'If the user has no XP in the requested period, returns `null` (HTTP 200, ' +
      'no body data — the frontend should handle this nullability).',
  })
  @ApiOkResource(UserRankSummaryDto, { description: 'User rank returned' })
  @rankingBadRequestResponse()
  async getMyRankForPeriod(@Query() query: LeaderboardQueryDto, @CurrentUser() user: JwtPayload) {
    const result = await this.userRankService.getUserRankForPeriod(
      user.sub,
      query.period ?? RankingPeriodEnum.ALL_TIME,
    );
    return this.presenter.getMyRankForPeriod(result);
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
      "Returns the authenticated user's percentile ranking in the selected period. " +
      'All fields are nullable — if the user has no rank, every field returns null. ' +
      'The percentile is calculated as `((totalUsers - rank) / totalUsers) * 100` rounded to 2 decimal places.',
  })
  @ApiOkResource(UserPercentileResponseDto, { description: 'User percentile returned' })
  @rankingBadRequestResponse()
  async getMyPercentile(
    @CurrentUser() user: JwtPayload,
    @Query() query: LeaderboardDistributionQueryDto,
  ) {
    const result = await this.getMyPercentileQueryHandler.execute({
      userId: user.sub,
      period: mapRankingPeriodEnumToDomain(query.period ?? RankingPeriodEnum.ALL_TIME),
    });
    return this.presenter.getMyPercentile(result);
  }

  // ─── GET /leaderboard/me/milestones ──────────────────────────────────────
  //
  // Protected by JwtGuard. Never throws.
  // The application returns `{ items }`; the presenter unwraps to a bare array.
  @Get('me/milestones')
  @UseGuards(JwtGuard)
  @rankingUnauthorizedResponse()
  @ApiOperation({
    summary: 'Get authenticated user ranking milestones',
    description:
      'Returns ranking milestones achieved by the authenticated user in chronological order. ' +
      'A milestone is earned when the user reaches a specific rank threshold ' +
      '(e.g. TOP_100, TOP_10, TOP_1). Returns an empty array if no milestones have been achieved.',
  })
  @ApiOkResourceArray(RankingMilestoneDto, {
    description: 'Ranking milestones returned',
  })
  async getMyRankingMilestones(@CurrentUser() user: JwtPayload) {
    const result = await this.getMyRankingMilestonesQueryHandler.execute({
      userId: user.sub,
    });
    return this.presenter.getMyRankingMilestones(result);
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
      "for the selected period. The `me` field contains the authenticated user's own entry. " +
      'All three fields (`above`, `me`, `below`) can be empty arrays or null depending on position.',
  })
  @ApiOkResource(NearbyRanksResponseDto, { description: 'Nearby ranks returned' })
  @rankingBadRequestResponse()
  async getNearbyRanks(@CurrentUser() user: JwtPayload, @Query() query: NearbyRanksQueryDto) {
    const result = await this.getNearbyRanksQueryHandler.execute({
      userId: user.sub,
      period: mapRankingPeriodEnumToDomain(query.period ?? RankingPeriodEnum.ALL_TIME),
      radius: query.radius ?? 2,
    });
    return this.presenter.getNearbyRanks(result);
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
  @ApiOkResource(RankMovementResponseDto, { description: 'Rank movement returned' })
  @rankingBadRequestResponse()
  async getMyRankMovement(@CurrentUser() user: JwtPayload, @Query() query: RankMovementQueryDto) {
    const result = await this.getMyRankMovementQueryHandler.execute({
      userId: user.sub,
      period: mapRankingPeriodEnumToDomain(query.period ?? LeaderboardPeriodEnum.WEEKLY),
    });
    return this.presenter.getMyRankMovement(result);
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
  @ApiOkResource(PeakRanksResponseDto, { description: 'Peak ranks returned' })
  async getMyPeakRanks(@CurrentUser() user: JwtPayload) {
    const result = await this.getMyPeakRanksQueryHandler.execute({ userId: user.sub });
    return this.presenter.getMyPeakRanks(result);
  }

  // ─── GET /leaderboard/me/history ────────────────────────────────────────
  //
  // Protected by JwtGuard. 400 from date validation (from/to checks).
  // The application returns `{ items }`; the presenter unwraps to a bare array.
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
  @ApiOkResourceArray(RankingHistoryItemDto, {
    description: 'Ranking history returned',
  })
  @rankingBadRequestResponse()
  async getMyRankingHistory(
    @CurrentUser() user: JwtPayload,
    @Query() query: MyRankingHistoryQueryDto,
  ) {
    const result = await this.getMyRankingHistoryQueryHandler.execute({
      userId: user.sub,
      period: mapRankingPeriodEnumToDomain(query.period ?? RankingPeriodEnum.ALL_TIME),
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    });
    return this.presenter.getMyRankingHistory(result);
  }

  // ─── GET /leaderboard/:userId ───────────────────────────────────────────
  //
  // Public endpoint. No 401/403/404. For unknown users, builds empty rank response.
  // `:userId` must be a UUID; ParseUUIDPipe rejects non-UUIDs at the boundary.
  @Get(':userId')
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @rankingUserIdParam()
  @ApiOperation({
    summary: 'Get user rank information',
    description:
      'Returns public rank information for a specific user (weekly, monthly, all-time). ' +
      'If the user has no ranking data, returns a ghost response with null ranks (no 404). ' +
      'Unlike the `/leaderboard/me` endpoint, this is public and requires no authentication.',
  })
  @ApiOkResource(UserRankResponseDto, { description: 'User rank returned' })
  async getUserRank(@Param('userId', new ParseUUIDPipe({ version: '7' })) userId: string) {
    const result = await this.userRankService.getUserRank(userId);
    return this.presenter.getUserRank(result);
  }

  // ─── GET /leaderboard/:userId/history ─────────────────────────────────
  //
  // Public endpoint. 400 from date validation only.
  @Get(':userId/history')
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @rankingUserIdParam()
  @ApiOperation({
    summary: 'Get public user ranking history',
    description:
      "Returns the specified user's public historical ranking progression over time. " +
      'Publicly accessible (no authentication required). ' +
      'Supports optional `from` and `to` (YYYY-MM-DD) date filters. ' +
      '400 if `from > to`.',
  })
  @ApiOkResource(PublicRankingHistoryResponseDto, {
    description: 'Public ranking history returned',
  })
  @rankingBadRequestResponse()
  async getUserRankingHistory(
    @Param('userId', new ParseUUIDPipe({ version: '7' })) userId: string,
    @Query() query: MyRankingHistoryQueryDto,
  ) {
    const result = await this.getUserRankingHistoryQueryHandler.execute({
      targetUserId: userId,
      period: mapRankingPeriodEnumToDomain(query.period ?? RankingPeriodEnum.ALL_TIME),
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    });
    return this.presenter.getUserRankingHistory(result);
  }

  // ─── GET /leaderboard/:userId/rank ─────────────────────────────────────
  //
  // Public endpoint. Returns undefined for users with no rank in the period.
  @Get(':userId/rank')
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @rankingUserIdParam()
  @ApiOperation({
    summary: 'Get user rank for specific period',
    description:
      "Returns the user's public rank summary for a specific period. " +
      'Publicly accessible (no authentication required). ' +
      'If the user has no XP in the period, returns `null` (HTTP 200, no body).',
  })
  @ApiOkResource(UserRankSummaryDto, { description: 'User rank returned' })
  @rankingBadRequestResponse()
  async getUserRankForPeriod(
    @Param('userId', new ParseUUIDPipe({ version: '7' })) userId: string,
    @Query() query: LeaderboardQueryDto,
  ) {
    const result = await this.userRankService.getUserRankForPeriod(
      userId,
      query.period ?? RankingPeriodEnum.ALL_TIME,
    );
    return this.presenter.getUserRankForPeriod(result);
  }
}
