/**
 * Achievement Admin Controller
 *
 * Admin-only endpoints for achievement system management.
 * All endpoints require the ACHIEVEMENT_ADMIN permission.
 */

import { Controller, Get, Post, Param, HttpCode, HttpStatus, ParseUUIDPipe } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permissions } from '@/common/authorization/decorators/permissions.decorator';
import { Permission } from '@/common/authorization/permissions';
import { ApiAuth } from '@/common/swagger/swagger-decorators';
import { ApiOkResource } from '@/common/swagger/api-ok';
import { AchievementApplicationService } from '../../application/achievement.application.service';
import { AchievementPresenter } from '../presenters/achievement.presenter';
import {
  AdminAchievementHistoryItemDto,
  ReevaluateUserResponseDto,
} from '../../dto/response/achievement-admin-response.dto';

@ApiTags('achievements')
@Controller('admin/achievements')
@ApiAuth()
export class AchievementAdminController {
  constructor(
    private readonly achievementApplicationService: AchievementApplicationService,
    private readonly presenter: AchievementPresenter,
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
  @ApiOkResource(ReevaluateUserResponseDto, { description: 'Re-evaluation completed' })
  async reevaluateUser(@Param('userId', new ParseUUIDPipe()) userId: string) {
    const result = await this.achievementApplicationService.reevaluateUserForController(userId);
    return this.presenter.reevaluateUser(result);
  }

  @Get('reevaluate/:userId/history')
  @Permissions(Permission.ACHIEVEMENT_ADMIN)
  @ApiOperation({ summary: 'Get achievement history for a user (admin)' })
  @ApiOkResource(AdminAchievementHistoryItemDto, {
    description: 'Achievement history returned',
  })
  async getUserHistory(@Param('userId', new ParseUUIDPipe()) userId: string) {
    const items = await this.achievementApplicationService.getUserHistoryForController(userId);
    return this.presenter.getUserHistory(items);
  }
}
