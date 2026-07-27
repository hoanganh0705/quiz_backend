/**
 * Report Controller
 *
 * Moderator-only routes for the comment report lifecycle:
 *   - `GET  /comments/reports`                       — list reports
 *   - `POST /comments/reports/:reportId/review`      — close a report
 *
 * The open-report action (`POST /comments/:commentId/reports`) is
 * defined in `comment.controller.ts` because it is a per-comment
 * action rather than a per-report action.
 */

import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import { Permissions } from '@/common/authorization/decorators/permissions.decorator';
import { Permission } from '@/common/authorization/permissions';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { CommentApplicationService } from '../../application/comment-application.service';
import { CommentPresenter } from '../presenters/comment.presenter';
import { ListReportsQueryDto, ReviewReportDto } from '../../dto/request';
import {
  ApiListCommentReportsResponses,
  ApiReviewCommentReportResponses,
} from '../swagger/comment-swagger-decorators';

@ApiTags('comments')
@Controller('comments/reports')
export class ReportController {
  constructor(
    private readonly application: CommentApplicationService,
    private readonly presenter: CommentPresenter,
  ) {}

  @Get()
  @Permissions(Permission.COMMENT_MODERATE)
  @ApiListCommentReportsResponses()
  async listReports(@CurrentUser() moderator: JwtPayload, @Query() query: ListReportsQueryDto) {
    const result = await this.application.listReports(moderator, query);
    return this.presenter.listReports(result);
  }

  @Post(':reportId/review')
  @Permissions(Permission.COMMENT_MODERATE)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiReviewCommentReportResponses()
  async reviewReport(
    @CurrentUser() moderator: JwtPayload,
    @Param('reportId', new ParseUUIDPipe({ version: '7' })) reportId: string,
    @Body() dto: ReviewReportDto,
  ) {
    const report = await this.application.reviewReport(moderator, reportId, dto);
    return this.presenter.reviewReport(report);
  }
}
