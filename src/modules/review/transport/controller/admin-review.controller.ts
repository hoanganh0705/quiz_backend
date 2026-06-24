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
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { Permissions } from '@/common/authorization/decorators/permissions.decorator';
import { Permission } from '@/common/authorization/permissions';
import { ApiAdminResource, ApiAdminUpdate } from '@/common/swagger/swagger-decorators';
import { ReviewAdminService } from '@/modules/review/domain/review-admin.service';
import { CursorMapper } from '@/modules/review/mappers/review-cursor.mapper';
import { ListPlatformReportsQueryDto, UpdateReportStatusDto } from '@/modules/review/dto/request';
import {
  PlatformReportsResponseDto,
  UpdateReportStatusResponseDto,
} from '@/modules/review/dto/response';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { JwtPayload } from '@/common/guards/jwt.guard';

@ApiTags('reviews')
@Controller('admin/reviews')
@ApiAdminResource()
export class AdminReviewController {
  constructor(private readonly reviewAdminService: ReviewAdminService) {}

  @Get('reports')
  @Permissions(Permission.REVIEW_MODERATE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List all platform-wide review reports for moderation',
    description:
      'Returns a paginated list of all review reports across the platform. ' +
      'Only accessible by admin users.',
  })
  @ApiOkResponse({
    description: 'Paginated list of platform-wide reports',
    type: PlatformReportsResponseDto,
  })
  async listPlatformReports(
    @Query() query: ListPlatformReportsQueryDto,
  ): Promise<PlatformReportsResponseDto> {
    const cursor = query.cursor ? CursorMapper.parseReport(query.cursor) : null;

    const { items, limit, hasNextPage, nextCursor } =
      await this.reviewAdminService.listPlatformReports({
        limit: query.limit ?? 20,
        cursor,
        status: query.status ?? null,
      });

    return {
      items: items.map((row) => ({
        reportId: row.reportId,
        reviewId: row.reviewId,
        quizId: row.quizId,
        quizTitle: row.quizTitle,
        reviewerUsername: row.reviewerUsername,
        reportedUserId: row.reportedUserId,
        rating: row.rating,
        content: row.content,
        reason: row.reason,
        details: row.details,
        status: row.status,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      })),
      pagination: {
        limit,
        hasNextPage,
        nextCursor: nextCursor ? CursorMapper.serializeReport(nextCursor) : null,
      },
    };
  }

  @Patch('reports/:reportId')
  @Permissions(Permission.REVIEW_MODERATE)
  @HttpCode(HttpStatus.OK)
  @ApiAdminUpdate({
    description: 'Report status updated successfully',
    type: UpdateReportStatusResponseDto,
  })
  async updateReportStatus(
    @Param('reportId', new ParseUUIDPipe()) reportId: string,
    @Body() body: UpdateReportStatusDto,
    @CurrentUser() actor: JwtPayload,
  ): Promise<UpdateReportStatusResponseDto> {
    await this.reviewAdminService.updateReportStatus(reportId, body.status, actor.sub);
    return { message: 'Report status updated successfully' };
  }
}
