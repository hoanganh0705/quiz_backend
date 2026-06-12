/**
 * Ranking Admin Controller
 *
 * Admin-only endpoints for ranking system management.
 * All endpoints require the 'admin' role.
 */

import { Controller, Get, Post, Query, HttpCode, HttpStatus } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { Roles } from '@/common/authorization/decorators/roles.decorator';
import { ApiAuth } from '@/common/swagger/swagger-decorators';
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

@ApiTags('leaderboard')
@Controller('admin/ranking')
@ApiAuth()
export class RankingAdminController {
  constructor(
    private readonly rankingAppService: RankingApplicationService,
    private readonly periodResetService: PeriodResetService,
  ) {}

  @Get('status')
  @Roles('admin')
  @ApiOperation({
    summary: 'Get ranking system status',
    description:
      'Returns operational status of the ranking system including scheduler state and dirty queue depth.',
  })
  @ApiOkResponse({ description: 'Ranking system status', type: RankingStatusResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized — missing or invalid token' })
  @ApiForbiddenResponse({ description: 'Forbidden — requires admin role' })
  @ApiHeader({ name: 'x-correlation-id', required: false, description: 'Request trace ID' })
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

  @Post('recalculate')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Trigger immediate rank recalculation',
    description:
      'Forces a full rank recalculation. Use sparingly — prefer the scheduled background process. ' +
      'Without a period parameter, all periods (all-time, weekly, monthly, daily) are recalculated.',
  })
  @ApiOkResponse({ description: 'Recalculation triggered', type: RecalculateResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized — missing or invalid token' })
  @ApiForbiddenResponse({ description: 'Forbidden — requires admin role' })
  @ApiBadRequestResponse({ description: 'Invalid period value' })
  @ApiHeader({ name: 'x-correlation-id', required: false, description: 'Request trace ID' })
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

  @Post('reset')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Trigger period reset',
    description:
      'Forces an immediate reset for a specific period. ' +
      'Without a period parameter, all due periods (weekly, monthly, daily) are reset.',
  })
  @ApiOkResponse({ description: 'Period reset initiated', type: PeriodResetResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized — missing or invalid token' })
  @ApiForbiddenResponse({ description: 'Forbidden — requires admin role' })
  @ApiBadRequestResponse({ description: 'Invalid period value' })
  @ApiHeader({ name: 'x-correlation-id', required: false, description: 'Request trace ID' })
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

  @Post('consistency-check')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Trigger consistency check',
    description: 'Forces an immediate consistency check and returns the full report.',
  })
  @ApiOkResponse({ description: 'Consistency check report', type: ConsistencyReportResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized — missing or invalid token' })
  @ApiForbiddenResponse({ description: 'Forbidden — requires admin role' })
  @ApiHeader({ name: 'x-correlation-id', required: false, description: 'Request trace ID' })
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
