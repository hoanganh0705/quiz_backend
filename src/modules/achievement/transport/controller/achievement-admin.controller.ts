/**
 * Achievement Admin Controller
 *
 * Admin-only endpoints for achievement system management.
 * All endpoints require the ACHIEVEMENT_ADMIN permission.
 */

import { Controller, Get, Post, Param, HttpCode, HttpStatus, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { Permissions } from '@/common/authorization/decorators/permissions.decorator';
import { Permission } from '@/common/authorization/permissions';
import { ApiAuth } from '@/common/swagger/swagger-decorators';
import { ScheduledEvaluationService } from '../../infrastructure/scheduled/scheduled-evaluation.service';
import { AchievementHistoryService } from '../../application/achievement-history.service';
import {
  WrappedReevaluateUserResponseDto,
  WrappedAdminHistoryListDto,
} from '../../dto/response/achievement-response-docs.dto';
import type { AchievementHistoryEntry } from '../../application/achievement-history.service';

@ApiTags('achievements')
@Controller('admin/achievements')
@ApiAuth()
export class AchievementAdminController {
  constructor(
    private readonly scheduledEvaluationService: ScheduledEvaluationService,
    private readonly achievementHistoryService: AchievementHistoryService,
  ) {}

  @Post('reevaluate/:userId')
  @Permissions(Permission.ACHIEVEMENT_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Re-evaluate all badges for a user',
    description:
      'Forces re-evaluation of every active badge for the specified user. Badges the user ' +
      'does not yet have will be checked against the rule engine. Use this to correct missed ' +
      'awards or retroactively grant badges after data fixes.',
  })
  @ApiOkResponse({
    description: 'Re-evaluation completed',
    type: WrappedReevaluateUserResponseDto,
  })
  async reevaluateUser(@Param('userId', new ParseUUIDPipe()) userId: string): Promise<{
    message: string;
    checked: number;
    awarded: number;
    errors: number;
  }> {
    const results = await this.scheduledEvaluationService.reevaluateUserBadges(userId);

    const awarded = results.filter((r) => r.awarded).length;
    const errors = results.filter((r) => !!r.error).length;

    return {
      message: `Re-evaluation completed for user ${userId}. Awarded ${awarded} badge(s), ${errors} error(s).`,
      checked: results.length,
      awarded,
      errors,
    };
  }

  @Get('reevaluate/:userId/history')
  @Permissions(Permission.ACHIEVEMENT_ADMIN)
  @ApiOperation({ summary: 'Get achievement history for a user (admin)' })
  @ApiOkResponse({
    description: 'Achievement history returned',
    type: WrappedAdminHistoryListDto,
  })
  async getUserHistory(
    @Param('userId', new ParseUUIDPipe()) userId: string,
  ): Promise<AchievementHistoryEntry[]> {
    return this.achievementHistoryService.getUserHistory(userId, { includeRevoked: true });
  }
}
