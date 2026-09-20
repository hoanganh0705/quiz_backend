import {
  Controller,
  Delete,
  Get,
  Patch,
  Param,
  Query,
  Body,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Permissions } from '@/common/authorization/decorators/permissions.decorator';
import { Permission } from '@/common/authorization/permissions';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { ReviewApplicationService } from '@/modules/review/application/review.application.service';
import { CursorMapper } from '@/modules/review/mappers/review-cursor.mapper';
import { ListPlatformReportsQueryDto, UpdateReportStatusDto } from '@/modules/review/dto/request';
import { ReviewPresenter } from '../presenters/review.presenter';
import {
  ApiAdminDeleteReviewResponses,
  ApiListPlatformReportsResponses,
  ApiUpdateReportStatusResponses,
} from '../swagger/review-swagger-decorators';
import { REVIEW_THROTTLE } from './throttle.constants';

@ApiTags('reviews')
@Controller('admin')
export class AdminReviewController {
  constructor(
    private readonly reviewApplicationService: ReviewApplicationService,
    private readonly presenter: ReviewPresenter,
  ) {}

  @Get('reviews/reports')
  @Permissions(Permission.REVIEW_MODERATE)
  @HttpCode(HttpStatus.OK)
  @Throttle({
    default: {
      limit: REVIEW_THROTTLE.listPlatformReports.limit,
      ttl: REVIEW_THROTTLE.listPlatformReports.ttl,
    },
  })
  @ApiOperation({ summary: 'List all reported reviews (moderator)' })
  @ApiListPlatformReportsResponses()
  async listPlatformReports(@Query() query: ListPlatformReportsQueryDto) {
    const cursor = query.cursor ? CursorMapper.parseReport(query.cursor) : null;
    const rawStatus = query.status ?? 'open';
    const filteredStatus = rawStatus === 'all' ? null : rawStatus;
    const result = await this.reviewApplicationService.listPlatformReports({
      limit: query.limit ?? 20,
      cursor,
      status: filteredStatus,
    });
    return this.presenter.listPlatformReports(result);
  }

  @Patch('reviews/reports/:reportId')
  @Permissions(Permission.REVIEW_MODERATE)
  @HttpCode(HttpStatus.OK)
  @Throttle({
    default: {
      limit: REVIEW_THROTTLE.updateReportStatus.limit,
      ttl: REVIEW_THROTTLE.updateReportStatus.ttl,
    },
  })
  @ApiOperation({ summary: 'Update the status of a report (moderator)' })
  @ApiUpdateReportStatusResponses()
  async updateReportStatus(
    @Param('reportId', new ParseUUIDPipe({ version: '7' })) reportId: string,
    @Body() body: UpdateReportStatusDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    const result = await this.reviewApplicationService.updateReportStatus(
      reportId,
      body.status,
      actor,
    );
    return this.presenter.updateReportStatus(result);
  }

  @Delete('reviews/:reviewId')
  @Permissions(Permission.REVIEW_MODERATE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({
    default: {
      limit: REVIEW_THROTTLE.adminDeleteReview.limit,
      ttl: REVIEW_THROTTLE.adminDeleteReview.ttl,
    },
  })
  @ApiOperation({ summary: 'Delete any review (moderator)' })
  @ApiAdminDeleteReviewResponses()
  async adminDeleteReview(
    @Param('reviewId', new ParseUUIDPipe({ version: '7' })) reviewId: string,
    @CurrentUser() actor: JwtPayload,
  ): Promise<void> {
    await this.reviewApplicationService.adminDeleteReview(reviewId, actor);
  }
}
