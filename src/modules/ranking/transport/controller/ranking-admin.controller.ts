/**
 * Ranking Admin Controller
 *
 * Admin-only endpoints for ranking system management.
 * All endpoints require the 'admin' role via PermissionsGuard.
 *
 * Error shape: Uses RankingDomainExceptionFilter to ensure ALL exceptions
 * are re-written to { statusCode, message, code, timestamp }.
 */

import {
  Controller,
  Get,
  Post,
  Query,
  HttpCode,
  HttpStatus,
  UseFilters,
  applyDecorators,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { Permissions } from '@/common/authorization/decorators/permissions.decorator';
import { Permission } from '@/common/authorization/permissions';
import { AUTH_SECURITY_NAME } from '@/core/swagger/swagger.config';
import { RankingDomainExceptionFilter } from '../filters/ranking-domain-exception.filter';
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
  WrappedRankingStatusResponseDto,
  WrappedRecalculateResponseDto,
  WrappedPeriodResetResponseDto,
  WrappedConsistencyReportResponseDto,
  RankingDomainErrorDto,
} from '../../dto';

// ─── Local helper decorators ───────────────────────────────────────────────────

function rankingAdminUnauthorizedResponse(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(AUTH_SECURITY_NAME),
    ApiUnauthorizedResponse({
      description:
        'Missing or invalid JWT bearer token. ' +
        'JwtGuard throws `UnauthorizedException` which `RankingDomainExceptionFilter` ' +
        'catches and re-writes to `{ statusCode, message, code, timestamp }`.',
      schema: { $ref: getSchemaPath(RankingDomainErrorDto) },
    }),
  );
}

function rankingAdminForbiddenResponse(): MethodDecorator {
  return applyDecorators(
    ApiForbiddenResponse({
      description:
        'Caller lacks the required `RANKING_ADMIN` permission. ' +
        'PermissionsGuard throws `ForbiddenException` which `RankingDomainExceptionFilter` ' +
        'catches and re-writes to `{ statusCode, message, code, timestamp }`.',
      schema: { $ref: getSchemaPath(RankingDomainErrorDto) },
    }),
  );
}

@ApiTags('leaderboard')
@ApiExtraModels(RankingDomainErrorDto)
@Controller('admin/ranking')
@UseFilters(RankingDomainExceptionFilter)
export class RankingAdminController {
  constructor(
    private readonly rankingAppService: RankingApplicationService,
    private readonly periodResetService: PeriodResetService,
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
  @ApiOkResponse({
    description: 'Ranking status returned',
    type: WrappedRankingStatusResponseDto,
  })
  async getStatus(): Promise<RankingStatusResponseDto> {
    const status = await this.rankingAppService.getStatus();
    return {
      schedulerRunning: status.schedulerRunning,
      dirtyQueueSize: status.dirtyQueueSize,
      nextConsistencyCheck: status.nextConsistencyCheck?.toISOString() ?? null,
      nextPeriodReset: {
        weekly: status.nextPeriodReset.weekly?.toISOString() ?? null,
        monthly: status.nextPeriodReset.monthly?.toISOString() ?? null,
        daily: status.nextPeriodReset.daily?.toISOString() ?? null,
      },
    };
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
  @ApiOkResponse({
    description: 'Recalculation triggered',
    type: WrappedRecalculateResponseDto,
  })
  async triggerRecalculation(@Query() query: RecalculateQueryDto): Promise<RecalculateResponseDto> {
    const period = query.period ? mapRankingPeriodEnumToDomain(query.period) : undefined;
    await this.rankingAppService.triggerImmediateRecalculation(period);

    return {
      message: query.period
        ? `Recalculation triggered for ${query.period}`
        : 'Recalculation triggered for all periods',
      period: query.period,
    };
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
      'If `period` is provided, resets only that period. ' +
      'Otherwise resets all due periods (daily, weekly, monthly). ' +
      'Requires `RANKING_ADMIN` permission.',
  })
  @ApiOkResponse({
    description: 'Period reset triggered',
    type: WrappedPeriodResetResponseDto,
  })
  async triggerPeriodReset(@Query() query: PeriodResetQueryDto): Promise<PeriodResetResponseDto> {
    if (query.period) {
      const period = mapRankingPeriodEnumToDomain(query.period);
      await this.periodResetService.executeReset(period, new Date());
      return { message: `Period reset initiated for ${query.period}`, period: query.period };
    }

    await this.periodResetService.performDailyReset();
    await this.periodResetService.performWeeklyReset();
    await this.periodResetService.performMonthlyReset();

    return { message: 'Period reset initiated for all due periods', period: 'all' };
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
  @ApiOkResponse({
    description: 'Consistency check completed',
    type: WrappedConsistencyReportResponseDto,
  })
  async triggerConsistencyCheck(): Promise<ConsistencyReportResponseDto> {
    const report = await this.rankingAppService.triggerConsistencyCheck();
    return {
      totalIssues: report.totalIssues,
      fixed: report.fixed,
      issues: report.issues.map((issue) => ({
        type: issue.type,
        userId: issue.userId,
        description: issue.description,
        severity: issue.severity,
      })),
    };
  }
}
