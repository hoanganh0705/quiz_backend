import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '@/common/decorators/public.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { ApiAuth } from '@/common/swagger/swagger-decorators';
import { Permissions } from '@/common/authorization/decorators/permissions.decorator';
import { Permission } from '@/common/authorization/permissions';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { ReviewApplicationService } from '../../application/review.application.service';
import { CreateReviewDto, UpdateReviewDto, ListReviewsQueryDto } from '../../dto/request';
import { ReviewPresenter } from '../presenters/review.presenter';
import { CursorMapper } from '../../mappers/review-cursor.mapper';
import {
  ApiCreateReviewResponses,
  ApiCreatorQuizReviewAnalyticsResponses,
  ApiDeleteReviewResponses,
  ApiListReviewsResponses,
  ApiQuizReviewStatsResponses,
  ApiUpdateReviewResponses,
} from '../swagger/review-swagger-decorators';
import { REVIEW_THROTTLE } from './throttle.constants';

@ApiTags('quizzes')
@Controller('quizzes')
export class QuizReviewController {
  constructor(
    private readonly reviewApplicationService: ReviewApplicationService,
    private readonly presenter: ReviewPresenter,
  ) {}

  @Post(':quizId/reviews')
  @ApiAuth()
  @Throttle({
    default: { limit: REVIEW_THROTTLE.createReview.limit, ttl: REVIEW_THROTTLE.createReview.ttl },
  })
  @ApiOperation({ summary: 'Create a review for a quiz' })
  @ApiCreateReviewResponses()
  async createReview(
    @Param('quizId', new ParseUUIDPipe({ version: '7' })) quizId: string,
    @CurrentUser() user: JwtPayload,
    @Body() payload: CreateReviewDto,
  ) {
    const result = await this.reviewApplicationService.createReview(quizId, payload, user);
    return this.presenter.createReview(result);
  }

  @Get(':quizId/reviews')
  @Public()
  @Throttle({
    default: { limit: REVIEW_THROTTLE.listReviews.limit, ttl: REVIEW_THROTTLE.listReviews.ttl },
  })
  @ApiOperation({ summary: 'List reviews for a quiz' })
  @ApiListReviewsResponses()
  async listReviews(
    @Param('quizId', new ParseUUIDPipe({ version: '7' })) quizId: string,
    @Query() query: ListReviewsQueryDto,
  ) {
    const limit = query.limit ?? 20;
    const cursor = query.cursor
      ? query.sort === 'helpful'
        ? CursorMapper.parseHelpful(query.cursor)
        : CursorMapper.parseReview(query.cursor)
      : null;
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
  @Throttle({
    default: {
      limit: REVIEW_THROTTLE.getQuizReviewStats.limit,
      ttl: REVIEW_THROTTLE.getQuizReviewStats.ttl,
    },
  })
  @ApiOperation({ summary: 'Get review statistics for a quiz' })
  @ApiQuizReviewStatsResponses()
  async getQuizReviewStats(@Param('quizId', new ParseUUIDPipe({ version: '7' })) quizId: string) {
    const result = await this.reviewApplicationService.getQuizReviewStats(quizId);
    return this.presenter.getQuizReviewStats(result);
  }

  @Get(':quizId/reviews/analytics')
  @ApiAuth()
  @Permissions(Permission.REVIEW_VIEW_QUIZ_ANALYTICS)
  @Throttle({
    default: {
      limit: REVIEW_THROTTLE.getCreatorQuizReviewAnalytics.limit,
      ttl: REVIEW_THROTTLE.getCreatorQuizReviewAnalytics.ttl,
    },
  })
  @ApiOperation({ summary: 'Get review analytics for a quiz (creator or moderator)' })
  @ApiCreatorQuizReviewAnalyticsResponses()
  async getCreatorQuizReviewAnalytics(
    @Param('quizId', new ParseUUIDPipe({ version: '7' })) quizId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.reviewApplicationService.getCreatorQuizReviewAnalytics(quizId, user);
    return this.presenter.getCreatorQuizReviewAnalytics(result);
  }

  @Patch(':quizId/reviews')
  @ApiAuth()
  @Throttle({
    default: { limit: REVIEW_THROTTLE.updateReview.limit, ttl: REVIEW_THROTTLE.updateReview.ttl },
  })
  @ApiOperation({ summary: 'Update the authenticated user review for a quiz' })
  @ApiUpdateReviewResponses()
  async updateReview(
    @Param('quizId', new ParseUUIDPipe({ version: '7' })) quizId: string,
    @CurrentUser() user: JwtPayload,
    @Body() payload: UpdateReviewDto,
  ) {
    const result = await this.reviewApplicationService.updateReview(quizId, payload, user);
    return this.presenter.updateReview(result);
  }

  @Delete(':quizId/reviews')
  @ApiAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({
    default: { limit: REVIEW_THROTTLE.deleteReview.limit, ttl: REVIEW_THROTTLE.deleteReview.ttl },
  })
  @ApiOperation({ summary: 'Delete the authenticated user review for a quiz' })
  @ApiDeleteReviewResponses()
  async deleteReview(
    @Param('quizId', new ParseUUIDPipe({ version: '7' })) quizId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    await this.reviewApplicationService.deleteReview(quizId, user);
  }
}
