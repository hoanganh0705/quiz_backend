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
  ApiNotFoundResponse,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiOperation,
  ApiOkResponse,
} from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import {
  ApiAuth,
  ApiAuthList,
  ApiAuthCreate,
  ApiPublicList,
} from '@/common/swagger/swagger-decorators';
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
import {
  ReviewDomainErrorDto,
  WrappedReviewListDto,
  WrappedReviewStatsDto,
  WrappedCreateReviewDto,
  WrappedUpdateReviewDto,
  WrappedDeleteMessageDto,
  WrappedMyReviewDto,
  WrappedQuizAnalyticsDto,
} from '../../dto/response/review-response-docs.dto';

// Local helpers — these decorators emit the response schemas that match the
// actual runtime error shapes produced by ReviewDomainExceptionFilter:
//
//   { statusCode: number, message: string, error: string }
//
// Use these for any 400 / 403 / 404 / 409 produced by a review domain error.
// (401, 500 are emitted by GlobalExceptionFilter as RFC 7807 ProblemDetail
// and are handled by the generic ApiAuth / ApiAuthList / ApiAuthCreate /
// ApiAuthUpdate decorators.)

const reviewNotFoundResponse = (description: string = 'Review not found') =>
  ApiNotFoundResponse({ description, type: ReviewDomainErrorDto });

const reviewForbiddenResponse = (
  description: string = 'You do not have permission to manage this review',
) =>
  ApiForbiddenResponse({
    description,
    type: ReviewDomainErrorDto,
  });

const reviewConflictResponse = (description: string = 'You have already reviewed this quiz') =>
  ApiConflictResponse({
    description,
    type: ReviewDomainErrorDto,
  });

const reviewBadRequestResponse = (description: string = 'Invalid request data') =>
  ApiBadRequestResponse({ description, type: ReviewDomainErrorDto });

@ApiTags('quizzes')
@Controller('quizzes')
@UseFilters(ReviewDomainExceptionFilter)
export class quizReviewController {
  constructor(private readonly reviewApplicationService: ReviewApplicationService) {}

  @Post(':quizId/reviews')
  @ApiAuthCreate({ description: 'Review created', type: WrappedCreateReviewDto })
  @reviewNotFoundResponse('Quiz not found')
  @reviewConflictResponse()
  @reviewBadRequestResponse('You must complete at least one attempt before reviewing this quiz')
  async createReview(
    @Param('quizId', new ParseUUIDPipe()) quizId: string,
    @CurrentUser() user: JwtPayload,
    @Body() payload: CreateReviewDto,
  ): Promise<CreateReviewResponseDto> {
    return this.reviewApplicationService.createReview(quizId, payload, user);
  }

  @Get(':quizId/reviews')
  @Public()
  @ApiPublicList({ description: 'Reviews returned', type: WrappedReviewListDto })
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
  @ApiPublicList({ description: 'Quiz review statistics returned', type: WrappedReviewStatsDto })
  @reviewNotFoundResponse('Quiz not found')
  async getQuizReviewStats(
    @Param('quizId', new ParseUUIDPipe()) quizId: string,
  ): Promise<ReviewStatsResponseDto> {
    return this.reviewApplicationService.getQuizReviewStats(quizId);
  }

  // Returns per-quiz analytics (not per-creator analytics).
  // The application service delegates to QuizAnalyticsService.getQuizAnalytics,
  // which can also throw QuizAnalyticsError. QuizAnalyticsError is NOT a
  // ReviewDomainError so the ReviewDomainExceptionFilter will not catch it;
  // it falls through to GlobalExceptionFilter and produces a 404
  // RFC 7807 ProblemDetail response (not the {statusCode, message, error}
  // envelope documented for the domain-filtered errors below).
  @Get(':quizId/reviews/analytics')
  @ApiAuthList({ description: 'Quiz review analytics returned', type: WrappedQuizAnalyticsDto })
  @reviewNotFoundResponse('Quiz not found')
  @reviewForbiddenResponse('You do not have permission to view analytics for this quiz')
  async getCreatorQuizReviewAnalytics(
    @Param('quizId', new ParseUUIDPipe()) quizId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<QuizAnalyticsResponseDto> {
    return this.reviewApplicationService.getCreatorQuizReviewAnalytics(quizId, user);
  }

  // Implementation returns `null` when the user has not reviewed the quiz
  // (NOT a 404). The wrapper documents `data: ReviewDetailDataDto | null`.
  @Get(':quizId/reviews/me')
  @ApiAuthList({ description: 'My review returned', type: WrappedMyReviewDto })
  async getMyQuizReview(
    @Param('quizId', new ParseUUIDPipe()) quizId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ReviewDetailResponseDto | null> {
    return this.reviewApplicationService.getMyQuizReview(quizId, user.sub);
  }

  // The implementation never throws 409 for updates — replace the bulk-style
  // ApiAuthUpdate decorator (which would document a phantom 409) with explicit
  // responses that match the actual behavior.
  @Patch(':quizId/reviews')
  @ApiAuth()
  @ApiOperation({
    summary: 'Update review',
    description:
      'Updates the authenticated user review for the given quiz. ' +
      'A 404 is returned when the user has no existing review on the quiz; ' +
      'a 403 is returned when the review belongs to another user.',
  })
  @ApiOkResponse({ description: 'Review updated', type: WrappedUpdateReviewDto })
  @reviewNotFoundResponse('Review not found')
  @reviewForbiddenResponse()
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
    summary: 'Delete review',
    description: 'Deletes the authenticated user review for the given quiz.',
  })
  @ApiOkResponse({ description: 'Review deleted', type: WrappedDeleteMessageDto })
  @reviewNotFoundResponse('Review not found')
  @reviewForbiddenResponse()
  async deleteReview(
    @Param('quizId', new ParseUUIDPipe()) quizId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<DeleteReviewResponseDto> {
    return this.reviewApplicationService.deleteReview(quizId, user);
  }
}
