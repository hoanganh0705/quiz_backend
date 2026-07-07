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
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiBadRequestResponse,
  ApiInternalServerErrorResponse,
} from '@nestjs/swagger';
import { Permissions } from '@/common/authorization/decorators/permissions.decorator';
import { Permission } from '@/common/authorization/permissions';
import { AUTH_SECURITY_NAME } from '@/core/swagger/swagger.config';
import { ProblemDetailDto, ErrorResponseExamples } from '@/common/swagger/swagger-schemas';
import { ReviewAdminService } from '@/modules/review/domain/review-admin.service';
import { CursorMapper } from '@/modules/review/mappers/review-cursor.mapper';
import { ListPlatformReportsQueryDto, UpdateReportStatusDto } from '@/modules/review/dto/request';
import {
  PlatformReportsResponseDto,
  UpdateReportStatusResponseDto,
} from '@/modules/review/dto/response';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import {
  WrappedPlatformReportsListDto,
  WrappedUpdateReportMessageDto,
} from '@/modules/review/dto/response/review-response-docs.dto';

// Admin review endpoints never throw ReviewDomainError (the admin service
// has no domain error classes; missing reports or invalid transitions result
// in empty result sets, not exceptions), so the ReviewDomainExceptionFilter
// has nothing to catch. Authentication and authorization failures fall
// through to GlobalExceptionFilter and are emitted as RFC 7807 ProblemDetail
// responses (401 from JwtGuard, 403 from PermissionsGuard).
// 404 and 409 are intentionally NOT documented because the admin service
// never throws them — listPlatformReports returns an empty result set, and
// updateReportStatus is a no-op when the report does not exist.

@ApiTags('reviews')
@Controller('admin/reviews')
@ApiBearerAuth(AUTH_SECURITY_NAME)
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
    type: WrappedPlatformReportsListDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid authentication token',
    type: ProblemDetailDto,
    example: ErrorResponseExamples.unauthorized,
  })
  @ApiForbiddenResponse({
    description: 'Authenticated user lacks the REVIEW_MODERATE permission',
    type: ProblemDetailDto,
    example: ErrorResponseExamples.forbidden,
  })
  @ApiBadRequestResponse({
    description: 'Query parameters failed validation',
    type: ProblemDetailDto,
    example: ErrorResponseExamples.badRequest,
  })
  @ApiInternalServerErrorResponse({
    description: 'Unexpected server error',
    type: ProblemDetailDto,
    example: ErrorResponseExamples.internalServerError,
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
  @ApiOperation({
    summary: 'Update platform review report status',
    description:
      'Updates the moderation status of a platform-wide review report. ' +
      'Only accessible by admin users. ' +
      'If the report does not exist the update is a no-op.',
  })
  @ApiOkResponse({
    description: 'Report status updated successfully',
    type: WrappedUpdateReportMessageDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid authentication token',
    type: ProblemDetailDto,
    example: ErrorResponseExamples.unauthorized,
  })
  @ApiForbiddenResponse({
    description: 'Authenticated user lacks the REVIEW_MODERATE permission',
    type: ProblemDetailDto,
    example: ErrorResponseExamples.forbidden,
  })
  @ApiBadRequestResponse({
    description: 'Request body failed validation',
    type: ProblemDetailDto,
    example: ErrorResponseExamples.badRequest,
  })
  @ApiInternalServerErrorResponse({
    description: 'Unexpected server error',
    type: ProblemDetailDto,
    example: ErrorResponseExamples.internalServerError,
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
