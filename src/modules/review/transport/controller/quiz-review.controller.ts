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
  ApiCreatedResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiConflictResponse,
  ApiBadRequestResponse,
  ApiInternalServerErrorResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { ApiAuth, ApiValidationRequest } from '@/common/swagger/swagger-decorators';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { ReviewApplicationService } from '../../application/review.application.service';
import { CreateReviewDto, UpdateReviewDto, ListReviewsQueryDto } from '../../dto/request';
import {
  ReviewListResponseDto,
  CreateReviewResponseDto,
  UpdateReviewResponseDto,
  DeleteReviewResponseDto,
  ReviewDetailResponseDto,
  ReviewStatsResponseDto,
} from '../../dto/response';
import { QuizAnalyticsResponseDto } from '@/modules/quiz/dto/response/quiz-analytics.dto';
import { ReviewDomainExceptionFilter } from '../filters/review-domain-exception.filter';
import { CursorMapper } from '../../mappers/review-cursor.mapper';

@ApiTags('quizzes')
@ApiBearerAuth()
@Controller('quizzes')
@UseFilters(ReviewDomainExceptionFilter)
export class QuizReviewController {
  constructor(private readonly reviewApplicationService: ReviewApplicationService) {}

  @Post(':quizId/reviews')
  @ApiAuth()
  @ApiOperation({
    summary: 'Create review',
    description:
      'Creates a star rating and optional written review for a quiz. One review per user per quiz.',
  })
  @ApiCreatedResponse({ description: 'Review created', type: CreateReviewResponseDto })
  @ApiNotFoundResponse({ description: 'Quiz not found' })
  @ApiConflictResponse({ description: 'You have already reviewed this quiz' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  @ApiValidationRequest()
  async createReview(
    @Param('quizId', new ParseUUIDPipe()) quizId: string,
    @CurrentUser() user: JwtPayload,
    @Body() payload: CreateReviewDto,
  ): Promise<CreateReviewResponseDto> {
    return this.reviewApplicationService.createReview(quizId, payload, user);
  }

  @Get(':quizId/reviews')
  @Public()
  @ApiOperation({
    summary: 'List quiz reviews',
    description:
      'Returns a paginated list of reviews for a specific quiz. Supports optional filtering by star rating and sorting by newest (default), most helpful, highest rating, or lowest rating.',
  })
  @ApiOkResponse({ description: 'Reviews returned', type: ReviewListResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  @ApiValidationRequest()
  async listReviews(
    @Param('quizId', new ParseUUIDPipe()) quizId: string,
    @Query() query: ListReviewsQueryDto,
  ): Promise<ReviewListResponseDto> {
    const limit = query.limit ?? 20;
    const cursor = query.cursor ? CursorMapper.parseReview(query.cursor) : null;
    return this.reviewApplicationService.listReviews(
      quizId,
      limit,
      cursor,
      query.rating,
      query.sort,
    );
  }

  @Get(':quizId/reviews/stats')
  @Public()
  @ApiOperation({
    summary: 'Get quiz review statistics',
    description: 'Returns aggregated review statistics for a specific quiz.',
  })
  @ApiOkResponse({ description: 'Quiz review statistics returned', type: ReviewStatsResponseDto })
  @ApiNotFoundResponse({ description: 'Quiz not found' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  async getQuizReviewStats(
    @Param('quizId', new ParseUUIDPipe()) quizId: string,
  ): Promise<ReviewStatsResponseDto> {
    return this.reviewApplicationService.getQuizReviewStats(quizId);
  }

  @Get(':quizId/reviews/analytics')
  @ApiBearerAuth()
  @ApiAuth()
  @ApiOperation({
    summary: 'Get quiz review analytics',
    description:
      'Returns creator-level review analytics (ratings, distribution, engagement) for a specific quiz. Only the quiz creator or an admin can access this endpoint.',
  })
  @ApiOkResponse({
    description: 'Quiz review analytics returned',
    type: QuizAnalyticsResponseDto,
    schema: {
      example: {
        quizId: '660e8400-e29b-41d4-a716-446655440000',
        metrics: {
          totalAttempts: 1250,
          uniquePlayers: 820,
          averageScore: 72.4,
          completionRate: 0.85,
        },
        reviewMetrics: {
          averageRating: 4.3,
          ratingCount: 312,
        },
        engagementMetrics: {
          bookmarkCount: 95,
        },
        popularity: {
          popularityScore: 87.6,
          trendingScore: 45.2,
        },
        lastUpdated: '2026-01-01T00:00:00.000Z',
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Quiz not found' })
  @ApiForbiddenResponse({
    description: 'You do not have permission to view analytics for this quiz',
  })
  @ApiBadRequestResponse({ description: 'Invalid quiz ID format' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  async getCreatorQuizReviewAnalytics(
    @Param('quizId', new ParseUUIDPipe()) quizId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<QuizAnalyticsResponseDto> {
    return this.reviewApplicationService.getCreatorQuizReviewAnalytics(quizId, user);
  }

  @Get(':quizId/reviews/me')
  @ApiAuth()
  @ApiOperation({
    summary: 'Get my review for a quiz',
    description:
      "Returns the authenticated user's existing review for a specific quiz, or null if no review exists.",
  })
  @ApiOkResponse({
    description: 'My review returned (or null if no review)',
    type: ReviewDetailResponseDto,
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
  @ApiNotFoundResponse({ description: 'Quiz not found' })
  @ApiBadRequestResponse({ description: 'Invalid quiz ID format' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  @ApiValidationRequest()
  async getMyQuizReview(
    @Param('quizId', new ParseUUIDPipe()) quizId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ReviewDetailResponseDto | null> {
    return this.reviewApplicationService.getMyQuizReview(quizId, user.sub);
  }

  @Patch(':quizId/reviews')
  @ApiAuth()
  @ApiOperation({
    summary: 'Update my review',
    description: "Updates the authenticated user's existing review for a quiz.",
  })
  @ApiOkResponse({ description: 'Review updated', type: UpdateReviewResponseDto })
  @ApiNotFoundResponse({ description: 'Quiz or review not found' })
  @ApiConflictResponse({ description: 'You have not reviewed this quiz yet' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  @ApiValidationRequest()
  async updateReview(
    @Param('quizId', new ParseUUIDPipe()) quizId: string,
    @CurrentUser() user: JwtPayload,
    @Body() payload: UpdateReviewDto,
  ): Promise<UpdateReviewResponseDto> {
    return this.reviewApplicationService.updateReview(quizId, payload, user);
  }

  @Delete(':quizId/reviews')
  @ApiAuth()
  @ApiOperation({
    summary: 'Delete my review',
    description: "Deletes the authenticated user's review for a quiz.",
  })
  @ApiOkResponse({ description: 'Review deleted', type: DeleteReviewResponseDto })
  @ApiNotFoundResponse({ description: 'Quiz or review not found' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  async deleteReview(
    @Param('quizId', new ParseUUIDPipe()) quizId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<DeleteReviewResponseDto> {
    return this.reviewApplicationService.deleteReview(quizId, user);
  }
}
