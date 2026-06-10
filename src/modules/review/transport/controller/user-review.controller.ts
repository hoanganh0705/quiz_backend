import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseFilters,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiInternalServerErrorResponse,
} from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { ApiAuth, ApiValidationRequest } from '@/common/swagger/swagger-decorators';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { ReviewApplicationService } from '../../application/review.application.service';
import { ListMyReviewsQueryDto, ListReportedReviewsQueryDto } from '../../dto/request';
import {
  MyReviewsResponseDto,
  MyQuizReviewResponseDto,
  ReportedReviewsResponseDto,
} from '../../dto/response';
import { ReviewDomainExceptionFilter } from '../filters/review-domain-exception.filter';
import { ReviewCursorMapper, ReportCursorMapper } from '../../mappers/review-cursor.mapper';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
@UseFilters(ReviewDomainExceptionFilter)
export class UserReviewController {
  constructor(private readonly reviewApplicationService: ReviewApplicationService) {}

  @Get('me/reported-reviews')
  @ApiAuth()
  @ApiOperation({
    summary: 'List my reported reviews',
    description:
      'Returns a cursor-paginated list of all reviews that the authenticated user has reported, ordered by newest report first.',
  })
  @ApiOkResponse({
    description: 'Reported reviews returned',
    type: ReportedReviewsResponseDto,
    schema: {
      example: {
        items: [
          {
            reportId: '990e8400-e29b-41d4-a716-446655440001',
            reviewId: '550e8400-e29b-41d4-a716-446655440099',
            quizId: '660e8400-e29b-41d4-a716-446655440000',
            quizTitle: 'JavaScript Fundamentals',
            reviewerUsername: 'bob_builder',
            rating: 1,
            content: 'This quiz is terrible!',
            reason: 'spam',
            details: 'Contains advertising links',
            status: 'open',
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        pagination: {
          limit: 10,
          hasNextPage: false,
          nextCursor: null,
        },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  @ApiValidationRequest()
  async listMyReportedReviews(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListReportedReviewsQueryDto,
  ): Promise<ReportedReviewsResponseDto> {
    return this.reviewApplicationService.listReportedReviews(user.sub, {
      limit: query.limit,
      cursor: query.cursor ? ReportCursorMapper.parse(query.cursor) : null,
    });
  }

  @Get(':userId/reviews')
  @Public()
  @ApiOperation({
    summary: 'List user reviews',
    description:
      'Returns public reviews created by the specified user, cursor-paginated and ordered by newest review first.',
  })
  @ApiOkResponse({
    description: 'User reviews returned',
    type: MyReviewsResponseDto,
    schema: {
      example: {
        items: [
          {
            reviewId: '550e8400-e29b-41d4-a716-446655440099',
            quizId: '660e8400-e29b-41d4-a716-446655440000',
            quizTitle: 'JavaScript Fundamentals',
            rating: 5,
            content: 'Excellent quiz',
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        pagination: {
          limit: 10,
          hasNextPage: true,
          nextCursor:
            'eyJjcmVhdGVkQXQiOiIyMDI2LTAxLTAxVDAwOjAwOjAwLjAwMFoiLCJyZXZpZXdJZCI6IjU1MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDA5OSJ9',
        },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  @ApiValidationRequest()
  async listReviewsByUser(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Query() query: ListMyReviewsQueryDto,
  ): Promise<MyReviewsResponseDto> {
    return this.reviewApplicationService.listReviewsByUser(userId, {
      limit: query.limit,
      cursor: query.cursor ? ReviewCursorMapper.parse(query.cursor) : null,
    });
  }

  @Get('me/reviews')
  @ApiAuth()
  @ApiOperation({
    summary: 'List my reviews or get my review for a specific quiz',
    description:
      "When called with a `quizId` query parameter, returns the authenticated user's existing review for that quiz (or null). Otherwise, returns a cursor-paginated list of all reviews created by the authenticated user.",
  })
  @ApiOkResponse({
    description: 'Review returned (single review when quizId is provided)',
    type: MyQuizReviewResponseDto,
    schema: {
      example: {
        reviewId: '550e8400-e29b-41d4-a716-446655440099',
        quizId: '660e8400-e29b-41d4-a716-446655440000',
        quizTitle: 'JavaScript Fundamentals',
        userId: '550e8400-e29b-41d4-a716-446655440000',
        username: 'alice_wonder',
        rating: 4,
        content: 'Excellent quiz',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  @ApiValidationRequest()
  async listMyReviews(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListMyReviewsQueryDto,
  ): Promise<MyReviewsResponseDto | MyQuizReviewResponseDto | null> {
    if (query.quizId) {
      return this.reviewApplicationService.getMyQuizReview(query.quizId, user.sub);
    }
    return this.reviewApplicationService.listUserReviews(user.sub, {
      limit: query.limit,
      cursor: query.cursor ? ReviewCursorMapper.parse(query.cursor) : null,
    });
  }
}
