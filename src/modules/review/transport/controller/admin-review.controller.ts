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
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { Roles } from '@/common/authorization/decorators/roles.decorator';
import { ApiAuth, ApiValidationRequest } from '@/common/swagger/swagger-decorators';
import { ReviewAdminService } from '@/modules/review/domain/review-admin.service';
import { CursorMapper } from '@/modules/review/mappers/review-cursor.mapper';
import {
  ListPlatformReportsQueryDto,
  UpdateReportStatusDto,
} from '@/modules/review/dto/request';
import {
  PlatformReportsResponseDto,
  UpdateReportStatusResponseDto,
} from '@/modules/review/dto/response';

@ApiTags('Admin Reviews')
@ApiBearerAuth()
@Controller('admin/reviews')
export class AdminReviewController {
  constructor(
    private readonly reviewAdminService: ReviewAdminService,
  ) {}

  @Get('reports')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiAuth()
  @ApiOperation({
    summary: 'List all platform-wide review reports for moderation',
    description:
      'Returns a paginated list of all review reports across the platform. ' +
      'Only accessible by admin users.',
  })
  @ApiOkResponse({ description: 'Paginated list of platform-wide reports', type: PlatformReportsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized — missing or invalid token' })
  @ApiForbiddenResponse({ description: 'Forbidden — requires admin role' })
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
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiAuth()
  @ApiOperation({
    summary: 'Update the status of a review report',
    description:
      'Allows an admin to change the status of a review report to ' +
      '`reviewed`, `dismissed`, or `actioned`.',
  })
  @ApiOkResponse({
    description: 'Report status updated successfully',
    type: UpdateReportStatusResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized — missing or invalid token' })
  @ApiForbiddenResponse({ description: 'Forbidden — requires admin role' })
  @ApiNotFoundResponse({ description: 'Report not found' })
  @ApiValidationRequest()
  async updateReportStatus(
    @Param('reportId', new ParseUUIDPipe()) reportId: string,
    @Body() body: UpdateReportStatusDto,
  ): Promise<UpdateReportStatusResponseDto> {
    await this.reviewAdminService.updateReportStatus(reportId, body.status);
    return { message: 'Report status updated successfully' };
  }
}
