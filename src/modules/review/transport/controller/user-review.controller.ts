import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { ApiAuth } from '@/common/swagger/swagger-decorators';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { ReviewApplicationService } from '../../application/review.application.service';
import { ListMyReviewsQueryDto, ListReportedReviewsQueryDto } from '../../dto/request';
import { CursorMapper } from '../../mappers/review-cursor.mapper';
import { ReviewPresenter } from '../presenters/review.presenter';
import {
  ApiGetMyReviewForQuizResponses,
  ApiListMyReportedReviewsResponses,
  ApiListMyReviewsResponses,
  ApiListReviewsByUserResponses,
} from '../swagger/review-swagger-decorators';

@ApiTags('users')
@Controller('users')
export class UserReviewController {
  constructor(
    private readonly reviewApplicationService: ReviewApplicationService,
    private readonly presenter: ReviewPresenter,
  ) {}

  @Get('me/reported-reviews')
  @ApiAuth()
  @ApiOperation({ summary: 'List reviews reported by the authenticated user' })
  @ApiListMyReportedReviewsResponses()
  async listMyReportedReviews(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListReportedReviewsQueryDto,
  ) {
    const result = await this.reviewApplicationService.listReportedReviews(user.sub, {
      limit: query.limit,
      cursor: query.cursor ? CursorMapper.parseReport(query.cursor) : null,
      // Phase 3 / Issue #7 — pass the optional `status` filter
      // through to the application service. Validated against
      // `REPORT_STATUS_VALUES` in the DTO; absent values default to
      // "all statuses" (back-compat with the previous contract).
      status: query.status ?? null,
    });
    return this.presenter.listMyReportedReviews(result);
  }

  @Get('me/reviews')
  @ApiAuth()
  @ApiOperation({ summary: "List the authenticated user's reviews" })
  @ApiListMyReviewsResponses()
  async listMyReviews(@CurrentUser() user: JwtPayload, @Query() query: ListMyReviewsQueryDto) {
    const result = await this.reviewApplicationService.listUserReviews(user.sub, {
      limit: query.limit,
      cursor: query.cursor ? CursorMapper.parseReview(query.cursor) : null,
    });
    return this.presenter.listMyReviews(result);
  }

  @Get('me/reviews/:quizId')
  @ApiAuth()
  @ApiOperation({ summary: "Get the authenticated user's review for a specific quiz" })
  @ApiGetMyReviewForQuizResponses()
  async getMyReviewForQuiz(
    @Param('quizId', new ParseUUIDPipe({ version: '7' })) quizId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.reviewApplicationService.getMyQuizReview(quizId, user.sub);
    return this.presenter.getMyQuizReview(result);
  }

  @Get(':userId/reviews')
  @Public()
  @ApiOperation({ summary: 'List reviews created by a user' })
  @ApiListReviewsByUserResponses()
  async listReviewsByUser(
    @Param('userId', new ParseUUIDPipe({ version: '7' })) userId: string,
    @Query() query: ListMyReviewsQueryDto,
  ) {
    const result = await this.reviewApplicationService.listReviewsByUser(userId, {
      limit: query.limit,
      cursor: query.cursor ? CursorMapper.parseReview(query.cursor) : null,
    });
    return this.presenter.listReviewsByUser(result);
  }
}
