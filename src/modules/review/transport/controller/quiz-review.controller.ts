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
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
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

@ApiTags('quizzes')
@Controller('quizzes')
export class quizReviewController {
  constructor(
    private readonly reviewApplicationService: ReviewApplicationService,
    private readonly presenter: ReviewPresenter,
  ) {}

  @Post(':quizId/reviews')
  @ApiAuth()
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
  @ApiOperation({ summary: 'List reviews for a quiz' })
  @ApiListReviewsResponses()
  async listReviews(
    @Param('quizId', new ParseUUIDPipe({ version: '7' })) quizId: string,
    @Query() query: ListReviewsQueryDto,
  ) {
    const limit = query.limit ?? 20;
    // Phase 5 / Issue #11 — the cursor shape depends on the
    // sort. The `helpful` sort uses a `{helpfulCount, reviewId}`
    // cursor so the predicate matches the ORDER BY; other sorts
    // use the original `{createdAt, reviewId}` cursor.
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
  @ApiOperation({ summary: 'Get review statistics for a quiz' })
  @ApiQuizReviewStatsResponses()
  async getQuizReviewStats(@Param('quizId', new ParseUUIDPipe({ version: '7' })) quizId: string) {
    const result = await this.reviewApplicationService.getQuizReviewStats(quizId);
    return this.presenter.getQuizReviewStats(result);
  }

  @Get(':quizId/reviews/analytics')
  @ApiAuth()
  // Phase 5 / Issue #21 — gate the creator-only analytics route
  // at the boundary via `PermissionsGuard`. The previous shape
  // was `@ApiAuth()` only: any authenticated user could reach the
  // service-layer policy check, which is defense-in-depth but
  // exposes the route to authenticated non-owners. The guard
  // closes the route to non-permitted callers before the service
  // runs. The service-layer `canViewAnalytics` check still runs
  // for ownership / moderation decisions.
  @Permissions(Permission.REVIEW_VIEW_QUIZ_ANALYTICS)
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
  @ApiOperation({ summary: 'Delete the authenticated user review for a quiz' })
  @ApiDeleteReviewResponses()
  async deleteReview(
    @Param('quizId', new ParseUUIDPipe({ version: '7' })) quizId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.reviewApplicationService.deleteReview(quizId, user);
    return this.presenter.deleteReview(result);
  }
}
