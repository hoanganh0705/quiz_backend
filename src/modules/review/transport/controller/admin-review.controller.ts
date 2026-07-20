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
  @ApiOperation({ summary: 'List all reported reviews (moderator)' })
  @ApiListPlatformReportsResponses()
  async listPlatformReports(@Query() query: ListPlatformReportsQueryDto) {
    const cursor = query.cursor ? CursorMapper.parseReport(query.cursor) : null;
    // Phase 4 / Issue #36 — default the moderator queue to `open`.
    // The previous behavior returned every status in newest-first
    // order, which let old-but-still-open reports fall off the
    // bottom. Pass `status=all` to see every status.
    //
    // The DTO's `status` is the wider `REVIEW_REPORT_PLATFORM_STATUS_VALUES`
    // (which includes `'all'`); narrow it to the four concrete
    // statuses (or `null`) here before passing it to the
    // application service.
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

  /**
   * Phase 1 / Issue #22 — moderator can delete any review (not only self-authored).
   *
   * The route is separate from `DELETE /quizzes/:quizId/reviews`, which is
   * keyed on `(quizId, user.sub)`. That self-delete endpoint intentionally
   * cannot reach another user's review even with `role === 'admin'`.
   */
  @Delete('reviews/:reviewId')
  @Permissions(Permission.REVIEW_MODERATE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete any review (moderator)' })
  @ApiAdminDeleteReviewResponses()
  async adminDeleteReview(
    @Param('reviewId', new ParseUUIDPipe({ version: '7' })) reviewId: string,
    @CurrentUser() actor: JwtPayload,
  ) {
    const result = await this.reviewApplicationService.adminDeleteReview(reviewId, actor);
    return this.presenter.deleteReview(result);
  }
}
