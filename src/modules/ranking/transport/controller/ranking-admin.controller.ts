/**
 * Ranking Admin Controller
 *
 * Admin-only endpoints for ranking system management.
 * All endpoints require the 'admin' role.
 */

import { Controller, Get, Post, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOkResponse } from '@nestjs/swagger';
import { Permissions } from '@/common/authorization/decorators/permissions.decorator';
import { Permission } from '@/common/authorization/permissions';
import {
  ApiAuth,
  ApiBadRequest,
  ApiInternalError,
} from '@/common/swagger/swagger-decorators';
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
} from '../../dto';

@ApiTags('leaderboard')
@Controller('admin/ranking')
export class RankingAdminController {
  constructor(
    private readonly rankingAppService: RankingApplicationService,
    private readonly periodResetService: PeriodResetService,
  ) {}

  @Get('status')
  @Permissions(Permission.RANKING_ADMIN)
  @ApiAuth()
  @ApiBadRequest()
  @ApiInternalError()
  @ApiOkResponse({ type: WrappedRankingStatusResponseDto })
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
  @Permissions(Permission.RANKING_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiAuth()
  @ApiBadRequest()
  @ApiInternalError()
  @ApiOkResponse({ type: WrappedRecalculateResponseDto })
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
  @Permissions(Permission.RANKING_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiAuth()
  @ApiBadRequest()
  @ApiInternalError()
  @ApiOkResponse({ type: WrappedPeriodResetResponseDto })
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
  @Permissions(Permission.RANKING_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiAuth()
  @ApiBadRequest()
  @ApiInternalError()
  @ApiOkResponse({ type: WrappedConsistencyReportResponseDto })
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
