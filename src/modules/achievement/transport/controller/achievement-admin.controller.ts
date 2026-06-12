/**
 * Achievement Admin Controller
 *
 * Admin-only endpoints for achievement system management.
 * All endpoints require the 'admin' role.
 */

import {
  Controller,
  Get,
  Post,
  Param,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiBadRequestResponse,
  ApiInternalServerErrorResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/authorization/decorators/roles.decorator';
import { ApiAuth } from '@/common/swagger/swagger-decorators';
import { ScheduledEvaluationService } from '../../infrastructure/scheduled/scheduled-evaluation.service';
import { AchievementHistoryService } from '../../application/achievement-history.service';
import { ReevaluateUserResponseDto } from '../../dto/response/achievement-admin-response.dto';

@ApiTags('achievements-admin')
@Controller('admin/achievements')
@ApiAuth()
@ApiUnauthorizedResponse({ description: 'Unauthorized — missing or invalid token' })
@ApiForbiddenResponse({ description: 'Forbidden — requires admin role' })
@ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
export class AchievementAdminController {
  constructor(
    private readonly scheduledEvaluationService: ScheduledEvaluationService,
    private readonly achievementHistoryService: AchievementHistoryService,
  ) {}

  @Post('reevaluate/:userId')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Re-evaluate all badges for a user',
    description:
      "Forces re-evaluation of every active badge for the specified user. Badges the user " +
      'does not yet have will be checked against the rule engine. Use this to correct missed ' +
      'awards or retroactively grant badges after data fixes.',
  })
  @ApiOkResponse({ description: 'Re-evaluation completed', type: ReevaluateUserResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid user ID' })
  async reevaluateUser(
    @Param('userId', new ParseUUIDPipe()) userId: string,
  ): Promise<ReevaluateUserResponseDto> {
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
  @Roles('admin')
  @ApiOperation({
    summary: "Get a user's achievement history",
    description:
      "Returns the full achievement history (including revoked) for a user. " +
      'Intended for admin review when investigating missing or incorrectly revoked badges.',
  })
  @ApiOkResponse({ description: 'Achievement history returned' })
  async getUserHistory(@Param('userId', new ParseUUIDPipe()) userId: string) {
    return this.achievementHistoryService.getUserHistory(userId, { includeRevoked: true });
  }
}
