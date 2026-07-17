/**
 * Ranking Admin Controller
 *
 * Admin-only endpoints for ranking system management.
 * All endpoints require the 'admin' role via PermissionsGuard.
 *
 * Error shape: All error responses (RFC 7807 `ProblemDetailDto`) are
 * produced by `GlobalExceptionFilter` after Phase 3.2. The prior
 * `RankingDomainExceptionFilter` (a `@Catch()` catch-all) has been
 * removed; `RankingDomainErrorDto` is also gone.
 */

import {
  Controller,
  Get,
  Post,
  Query,
  HttpCode,
  HttpStatus,
  applyDecorators,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Permissions } from '@/common/authorization/decorators/permissions.decorator';
import { Permission } from '@/common/authorization/permissions';
import { ErrorResponseExamples, ProblemDetailDto } from '@/common/swagger/swagger-schemas';
import { AUTH_SECURITY_NAME } from '@/core/swagger/swagger.config';
import { RankingApplicationService } from '../../application/ranking.application.service';
import { PeriodResetService } from '../../domain/services';
import { mapRankingPeriodEnumToDomain } from '../../application/get-my-ranking-history.query';
import {
  RecalculateQueryDto,
  PeriodResetQueryDto,
} from '../../dto/request/ranking-admin-query.dto';
import {
  RankingStatusResponseDto,
  RecalculateResponseDto,
  PeriodResetResponseDto,
  ConsistencyReportResponseDto,
} from '../../dto/response/ranking-admin-response.dto';
import { RankingPresenter } from '../presenters/ranking.presenter';
import { ApiOkResource } from '@/common/swagger/api-ok';

// ─── Local helper decorators ───────────────────────────────────────────────────
//
// All error responses (401 from JwtGuard, 403 from PermissionsGuard,
// 422 from `InvalidXpEventError`, 500 from `RankCalculationError` /
// `PeriodResetError`) are routed through `GlobalExceptionFilter` as
// RFC 7807 `ProblemDetailDto` after Phase 3.2.

function rankingAdminUnauthorizedResponse(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(AUTH_SECURITY_NAME),
    ApiUnauthorizedResponse({
      description:
        'Missing or invalid JWT bearer token. ' +
        'JwtGuard throws `UnauthorizedException` which `GlobalExceptionFilter` ' +
        'emits as RFC 7807 `ProblemDetailDto`.',
      type: ProblemDetailDto,
      example: ErrorResponseExamples.unauthorized,
    }),
  );
}

function rankingAdminForbiddenResponse(): MethodDecorator {
  return applyDecorators(
    ApiForbiddenResponse({
      description:
        'Caller lacks the required `RANKING_ADMIN` permission. ' +
        'PermissionsGuard throws `ForbiddenException` which `GlobalExceptionFilter` ' +
        'emits as RFC 7807 `ProblemDetailDto`.',
      type: ProblemDetailDto,
      example: ErrorResponseExamples.forbidden,
    }),
  );
}

@ApiTags('leaderboard')
@Controller('admin/ranking')
export class RankingAdminController {
  constructor(
    private readonly rankingAppService: RankingApplicationService,
    private readonly periodResetService: PeriodResetService,
    private readonly presenter: RankingPresenter,
  ) {}

  // ─── GET /admin/ranking/status ─────────────────────────────────────────
  //
  // PermissionsGuard enforces RANKING_ADMIN. No 400/404 possible.
  @Get('status')
  @Permissions(Permission.RANKING_ADMIN)
  @rankingAdminUnauthorizedResponse()
  @rankingAdminForbiddenResponse()
  @ApiOperation({
    summary: 'Get ranking system status',
    description:
      'Returns the current operational status of the ranking system: scheduler state, ' +
      'dirty queue size (users awaiting recalculation), next consistency check time, ' +
      'and next period reset times for each interval. Requires `RANKING_ADMIN` permission.',
  })
  @ApiOkResource(RankingStatusResponseDto, { description: 'Ranking status returned' })
  async getStatus() {
    const status = await this.rankingAppService.getStatus();
    const result: RankingStatusResponseDto = {
      schedulerRunning: status.schedulerRunning,
      dirtyQueueSize: status.dirtyQueueSize,
      nextConsistencyCheck: status.nextConsistencyCheck?.toISOString() ?? null,
      nextPeriodReset: {
        weekly: status.nextPeriodReset.weekly?.toISOString() ?? null,
        monthly: status.nextPeriodReset.monthly?.toISOString() ?? null,
        daily: status.nextPeriodReset.daily?.toISOString() ?? null,
      },
    };
    return this.presenter.getStatus(result);
  }

  // ─── POST /admin/ranking/recalculate ────────────────────────────────────
  //
  // PermissionsGuard enforces RANKING_ADMIN. No 400/404 possible.
  // Controller never throws — rankingAppService methods are void.
  @Post('recalculate')
  @Permissions(Permission.RANKING_ADMIN)
  @HttpCode(HttpStatus.OK)
  @rankingAdminUnauthorizedResponse()
  @rankingAdminForbiddenResponse()
  @ApiOperation({
    summary: 'Trigger immediate rank recalculation',
    description:
      'Triggers an immediate full rank recalculation across all users. ' +
      'If `period` query param is provided, recalculates only that period. ' +
      'Otherwise recalculates all four periods (daily, weekly, monthly, all-time). ' +
      'This is an administrative operation — prefer the scheduled background process. ' +
      'Requires `RANKING_ADMIN` permission.',
  })
  @ApiOkResource(RecalculateResponseDto, { description: 'Recalculation triggered' })
  async triggerRecalculation(@Query() query: RecalculateQueryDto) {
    const period = query.period ? mapRankingPeriodEnumToDomain(query.period) : undefined;
    await this.rankingAppService.triggerImmediateRecalculation(period);

    const result: RecalculateResponseDto = {
      message: query.period
        ? `Recalculation triggered for ${query.period}`
        : 'Recalculation triggered for all periods',
      period: query.period,
    };
    return this.presenter.triggerRecalculation(result);
  }

  // ─── POST /admin/ranking/reset ─────────────────────────────────────────
  //
  // PermissionsGuard enforces RANKING_ADMIN. No 400/404 possible.
  @Post('reset')
  @Permissions(Permission.RANKING_ADMIN)
  @HttpCode(HttpStatus.OK)
  @rankingAdminUnauthorizedResponse()
  @rankingAdminForbiddenResponse()
  @ApiOperation({
    summary: 'Trigger period reset',
    description:
      'Manually triggers period resets for the ranking system. ' +
      'If `period` is provided, resets only that period regardless of the current time. ' +
      'If `period` is omitted, fires daily, weekly, and monthly resets only when their ' +
      'UTC schedules are due (each method short-circuits silently if not at the scheduled time, ' +
      'returning 0 users affected). Requires `RANKING_ADMIN` permission.',
  })
  @ApiOkResource(PeriodResetResponseDto, { description: 'Period reset triggered' })
  async triggerPeriodReset(@Query() query: PeriodResetQueryDto) {
    let result: PeriodResetResponseDto;
    if (query.period) {
      const period = mapRankingPeriodEnumToDomain(query.period);
      await this.periodResetService.executeReset(period, new Date());
      result = { message: `Period reset initiated for ${query.period}`, period: query.period };
    } else {
      await this.periodResetService.performDailyReset();
      await this.periodResetService.performWeeklyReset();
      await this.periodResetService.performMonthlyReset();
      result = { message: 'Period reset initiated for all due periods', period: 'all' };
    }
    return this.presenter.triggerPeriodReset(result);
  }

  // ─── POST /admin/ranking/consistency-check ─────────────────────────────
  //
  // PermissionsGuard enforces RANKING_ADMIN. No 400/404 possible.
  @Post('consistency-check')
  @Permissions(Permission.RANKING_ADMIN)
  @HttpCode(HttpStatus.OK)
  @rankingAdminUnauthorizedResponse()
  @rankingAdminForbiddenResponse()
  @ApiOperation({
    summary: 'Trigger consistency check',
    description:
      'Runs an immediate consistency check across all ranking data. ' +
      'Detects XP mismatches, rank gaps, and missing ranks. ' +
      'Automatically fixes issues where possible. ' +
      'Returns a report of all issues found and fixed. ' +
      'Requires `RANKING_ADMIN` permission.',
  })
  @ApiOkResource(ConsistencyReportResponseDto, { description: 'Consistency check completed' })
  async triggerConsistencyCheck() {
    const report = await this.rankingAppService.triggerConsistencyCheck();
    const result: ConsistencyReportResponseDto = {
      totalIssues: report.totalIssues,
      fixed: report.fixed,
      issues: report.issues.map((issue) => ({
        type: issue.type,
        userId: issue.userId,
        description: issue.description,
        severity: issue.severity,
      })),
    };
    return this.presenter.triggerConsistencyCheck(result);
  }
}
