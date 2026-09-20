import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Permissions } from '@/common/authorization/decorators/permissions.decorator';
import { Permission } from '@/common/authorization/permissions';
import { JwtGuard } from '@/common/guards/jwt.guard';
import { ApiForbidden, ApiAuth } from '@/common/swagger/swagger-decorators';
import { ApiOkResource, ApiOkResourceList } from '@/common/swagger/api-ok';
import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';
import { ACHIEVEMENT_THROTTLE_VALUES } from '@/core/config/achievement-throttle.config';
import { AchievementApplicationService } from '../../application/achievement.application.service';
import { AchievementPresenter } from '../presenters/achievement.presenter';
import {
  AdminAchievementHistoryItemDto,
  ReevaluateUserResponseDto,
} from '../../dto/response/achievement-admin-response.dto';

@ApiTags('achievements')
@Controller('admin/achievements')
@UseGuards(JwtGuard)
@ApiAuth()
export class AchievementAdminController {
  constructor(
    private readonly achievementApplicationService: AchievementApplicationService,
    private readonly presenter: AchievementPresenter,
  ) {}

  @Post('reevaluate/:userId')
  @Permissions(Permission.ACHIEVEMENT_ADMIN)
  @Throttle({ default: ACHIEVEMENT_THROTTLE_VALUES.reevaluateUser })
  @ApiForbidden()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'reevaluateUserBadges',
    summary: 'Re-evaluate all badges for a user',
    description:
      'Forces re-evaluation of every active badge for the specified user. Badges the user ' +
      'does not yet have will be checked against the rule engine. Use this to correct missed ' +
      'awards or retroactively grant badges after data fixes.',
  })
  @ApiParam({ name: 'userId', format: 'uuid' })
  @ApiOkResource(ReevaluateUserResponseDto, { description: 'Re-evaluation completed' })
  async reevaluateUser(@Param('userId', new ParseUUIDPipe({ version: '7' })) userId: string) {
    const result = await this.achievementApplicationService.reevaluateUserForController(userId);
    return this.presenter.reevaluateUser(result);
  }

  @Get('reevaluate/:userId/history')
  @Permissions(Permission.ACHIEVEMENT_ADMIN)
  @Throttle({ default: ACHIEVEMENT_THROTTLE_VALUES.getUserHistory })
  @ApiForbidden()
  @ApiOperation({
    operationId: 'getUserAchievementHistory',
    summary: 'Get achievement history for a user (admin)',
  })
  @ApiParam({ name: 'userId', format: 'uuid' })
  @ApiOkResourceList(AdminAchievementHistoryItemDto, 'offset', {
    description: 'Achievement history returned',
  })
  async getUserHistory(
    @Param('userId', new ParseUUIDPipe({ version: '7' })) userId: string,
    @Query() query: PaginationQueryDto,
  ) {
    const items = await this.achievementApplicationService.getUserHistoryForController(
      userId,
      query,
    );
    return this.presenter.getUserHistory(items);
  }
}
