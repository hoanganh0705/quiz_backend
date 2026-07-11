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
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { ApiAuth, ApiAuthErrors, ApiPublicErrors } from '@/common/swagger/swagger-decorators';
import { ApiCreatedResource, ApiOkResource, ApiOkResourceList } from '@/common/swagger/api-ok';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { ReviewApplicationService } from '../../application/review.application.service';
import { CreateReviewDto, UpdateReviewDto, ListReviewsQueryDto } from '../../dto/request';
import { CreateReviewResponseDto } from '../../dto/response/create-review-response.dto';
import { DeleteReviewResponseDto } from '../../dto/response/delete-review-response.dto';
import { ReviewListResponseDto } from '../../dto/response/review-list-response.dto';
import { ReviewStatsResponseDto } from '../../dto/response/review-stats-response.dto';
import { UpdateReviewResponseDto } from '../../dto/response/update-review-response.dto';
import { ReviewDetailResponseDto } from '../../dto/response/review-detail-response.dto';
import { ReviewDomainErrorDto } from '../../dto/response/review-domain-error.dto';
import { ReviewDomainExceptionFilter } from '../filters/review-domain-exception.filter';
import { CursorMapper } from '../../mappers/review-cursor.mapper';
import { QuizAnalyticsResponseDto } from '@/modules/quiz/dto/response/quiz-analytics.dto';
import { ReviewPresenter } from '../presenters/review.presenter';

// Local helpers — these decorators emit the response schemas that match the
// actual runtime error shapes produced by ReviewDomainExceptionFilter:
//
//   { statusCode: number, message: string, error: string }
//
// Use these for any 400 / 403 / 404 / 409 produced by a review domain error.
// (401, 500 are emitted by GlobalExceptionFilter as RFC 7807 ProblemDetail
// and are handled by ApiAuth + ApiAuthErrors / ApiPublicErrors.)

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
  constructor(
    private readonly reviewApplicationService: ReviewApplicationService,
    private readonly presenter: ReviewPresenter,
  ) {}

  @Post(':quizId/reviews')
  @ApiAuth()
  @ApiCreatedResource(CreateReviewResponseDto, { description: 'Review created' })
  @reviewNotFoundResponse('Quiz not found')
  @reviewConflictResponse()
  @reviewBadRequestResponse('You must complete at least one attempt before reviewing this quiz')
  async createReview(
    @Param('quizId', new ParseUUIDPipe()) quizId: string,
    @CurrentUser() user: JwtPayload,
    @Body() payload: CreateReviewDto,
  ) {
    const result = await this.reviewApplicationService.createReview(quizId, payload, user);
    return this.presenter.createReview(result);
  }

  @Get(':quizId/reviews')
  @Public()
  @ApiPublicErrors()
  @ApiOkResourceList(ReviewListResponseDto, 'cursor', { description: 'Reviews returned' })
  async listReviews(
    @Param('quizId', new ParseUUIDPipe()) quizId: string,
    @Query() query: ListReviewsQueryDto,
  ) {
    const limit = query.limit ?? 20;
    const cursor = query.cursor ? CursorMapper.parseReview(query.cursor) : null;
    const result = await this.reviewApplicationService.listReviews(
      quizId,
      limit,
      cursor,
      query.rating,
      query.sort,
    );
    return this.presenter.listReviews(result);
  }

  @Get(':quizId/reviews/stats')
  @Public()
  @ApiPublicErrors()
  @ApiOkResource(ReviewStatsResponseDto, { description: 'Quiz review statistics returned' })
  @reviewNotFoundResponse('Quiz not found')
  async getQuizReviewStats(@Param('quizId', new ParseUUIDPipe()) quizId: string) {
    const result = await this.reviewApplicationService.getQuizReviewStats(quizId);
    return this.presenter.getQuizReviewStats(result);
  }

  // Returns per-quiz analytics (not per-creator analytics).
  // The application service delegates to QuizAnalyticsService.getQuizAnalytics,
  // which can also throw QuizAnalyticsError. QuizAnalyticsError is NOT a
  // ReviewDomainError so the ReviewDomainExceptionFilter will not catch it;
  // it falls through to GlobalExceptionFilter and produces a 404
  // RFC 7807 ProblemDetail response (not the {statusCode, message, error}
  // envelope documented for the domain-filtered errors below).
  @Get(':quizId/reviews/analytics')
  @ApiAuth()
  @ApiAuthErrors()
  @ApiOkResource(QuizAnalyticsResponseDto, { description: 'Quiz review analytics returned' })
  @reviewNotFoundResponse('Quiz not found')
  @reviewForbiddenResponse('You do not have permission to view analytics for this quiz')
  async getCreatorQuizReviewAnalytics(
    @Param('quizId', new ParseUUIDPipe()) quizId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.reviewApplicationService.getCreatorQuizReviewAnalytics(quizId, user);
    return this.presenter.getCreatorQuizReviewAnalytics(result);
  }

  // Implementation returns `null` when the user has not reviewed the quiz
  // (NOT a 404). The wrapper documents `data: ReviewDetailDataDto | null`.
  @Get(':quizId/reviews/me')
  @ApiAuth()
  @ApiOkResource(ReviewDetailResponseDto, {
    description:
      'My review for the quiz. `data` is `null` when the user has not reviewed the quiz.',
  })
  async getMyQuizReview(
    @Param('quizId', new ParseUUIDPipe()) quizId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.reviewApplicationService.getMyQuizReview(quizId, user.sub);
    return this.presenter.getMyQuizReview(result);
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
  @ApiOkResource(UpdateReviewResponseDto, { description: 'Review updated' })
  @reviewNotFoundResponse('Review not found')
  @reviewForbiddenResponse()
  async updateReview(
    @Param('quizId', new ParseUUIDPipe()) quizId: string,
    @CurrentUser() user: JwtPayload,
    @Body() payload: UpdateReviewDto,
  ) {
    const result = await this.reviewApplicationService.updateReview(quizId, payload, user);
    return this.presenter.updateReview(result);
  }

  @Delete(':quizId/reviews')
  @ApiAuth()
  @ApiOperation({
    summary: 'Delete review',
    description: 'Deletes the authenticated user review for the given quiz.',
  })
  @ApiOkResource(DeleteReviewResponseDto, { description: 'Review deleted' })
  @reviewNotFoundResponse('Review not found')
  @reviewForbiddenResponse()
  async deleteReview(
    @Param('quizId', new ParseUUIDPipe()) quizId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.reviewApplicationService.deleteReview(quizId, user);
    return this.presenter.deleteReview(result);
  }
}
