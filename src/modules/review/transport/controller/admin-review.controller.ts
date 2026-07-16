import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Body,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Permissions } from '@/common/authorization/decorators/permissions.decorator';
import { Permission } from '@/common/authorization/permissions';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { ReviewApplicationService } from '@/modules/review/application/review.application.service';
import { CursorMapper } from '@/modules/review/mappers/review-cursor.mapper';
import { ListPlatformReportsQueryDto, UpdateReportStatusDto } from '@/modules/review/dto/request';
import { ReviewPresenter } from '../presenters/review.presenter';
import {
  ApiListPlatformReportsResponses,
  ApiUpdateReportStatusResponses,
} from '../swagger/review-swagger-decorators';

@ApiTags('reviews')
@Controller('admin/reviews')
export class AdminReviewController {
  constructor(
    private readonly reviewApplicationService: ReviewApplicationService,
    private readonly presenter: ReviewPresenter,
  ) {}

  @Get('reports')
  @Permissions(Permission.REVIEW_MODERATE)
  @HttpCode(HttpStatus.OK)
  @ApiListPlatformReportsResponses()
  async listPlatformReports(@Query() query: ListPlatformReportsQueryDto) {
    const cursor = query.cursor ? CursorMapper.parseReport(query.cursor) : null;
    const result = await this.reviewApplicationService.listPlatformReports({
      limit: query.limit ?? 20,
      cursor,
      status: query.status ?? null,
    });
    return this.presenter.listPlatformReports(result);
  }

  @Patch('reports/:reportId')
  @Permissions(Permission.REVIEW_MODERATE)
  @HttpCode(HttpStatus.OK)
  @ApiUpdateReportStatusResponses()
  async updateReportStatus(
    @Param('reportId', new ParseUUIDPipe()) reportId: string,
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
}
