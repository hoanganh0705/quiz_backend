import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { ApiAuth } from '@/common/swagger/swagger-decorators';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { ReviewApplicationService } from '../../application/review.application.service';
import { HelpfulReviewDto, ReportReviewDto } from '../../dto/request';
import { ReviewPresenter } from '../presenters/review.presenter';
import {
  ApiGetReviewByIdResponses,
  ApiMarkReviewHelpfulResponses,
  ApiRemoveHelpfulVoteResponses,
  ApiReportReviewResponses,
  ApiReviewDashboardResponses,
} from '../swagger/review-swagger-decorators';

@ApiTags('reviews')
@Controller('reviews')
export class ReviewController {
  constructor(
    private readonly reviewApplicationService: ReviewApplicationService,
    private readonly presenter: ReviewPresenter,
  ) {}

  @Get('me')
  @ApiAuth()
  @ApiOperation({ summary: "Get the authenticated user's review dashboard" })
  @ApiReviewDashboardResponses()
  async getMyReviewDashboard(@CurrentUser() user: JwtPayload) {
    const result = await this.reviewApplicationService.getMyReviewDashboard(user);
    return this.presenter.getMyReviewDashboard(result);
  }

  @Post(':reviewId/helpful')
  @ApiAuth()
  @ApiOperation({ summary: 'Mark a review as helpful' })
  @ApiMarkReviewHelpfulResponses()
  async markReviewHelpful(
    @Param('reviewId', new ParseUUIDPipe({ version: '7' })) reviewId: string,
    @CurrentUser() user: JwtPayload,
    @Body() payload: HelpfulReviewDto,
  ) {
    const result = await this.reviewApplicationService.markReviewHelpful(reviewId, payload, user);
    return this.presenter.markReviewHelpful(result);
  }

  @Delete(':reviewId/helpful')
  @ApiAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove the helpful vote on a review' })
  @ApiRemoveHelpfulVoteResponses()
  async removeHelpfulVote(
    @Param('reviewId', new ParseUUIDPipe({ version: '7' })) reviewId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    await this.reviewApplicationService.removeHelpfulVote(reviewId, user);
  }

  @Post(':reviewId/report')
  @ApiAuth()
  // Phase 2 / Issue #16 — cap report filing at 5 requests / minute /
  // IP. Without this, a bot network can file 100k reports against a
  // single review by 100k distinct user accounts (the per-user
  // UNIQUE constraint blocks *duplicate* reports from one user but
  // not the cross-user spam). This makes reports costlier to file,
  // matches the rate limit used for comments reports (same threat
  // model), and gives the global throttler a clean 429 surface for
  // abusive clients.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Report a review' })
  @ApiReportReviewResponses()
  async reportReview(
    @Param('reviewId', new ParseUUIDPipe({ version: '7' })) reviewId: string,
    @CurrentUser() user: JwtPayload,
    @Body() payload: ReportReviewDto,
  ) {
    const result = await this.reviewApplicationService.reportReview(reviewId, user, payload);
    return this.presenter.reportReview(result);
  }

  @Get(':reviewId')
  // Phase 5 / Issue #20 — the previous `@Public()` decorator let
  // any unauthenticated client enumerate UUIDs and read review
  // content (including sensitive text like harassment / profanity)
  // against hidden quizzes. The endpoint is now `@ApiAuth()` only;
  // the service-layer policy still returns 404 for reviews of
  // hidden / unpublished quizzes via `assertQuizVisibleById`, so a
  // hidden quiz's review remains inaccessible.
  @ApiAuth()
  @ApiOperation({ summary: 'Get a review by ID' })
  @ApiGetReviewByIdResponses()
  async getReviewById(
    @Param('reviewId', new ParseUUIDPipe({ version: '7' })) reviewId: string,
    @CurrentUser() _user: JwtPayload,
  ) {
    // `_user` is unused at the service layer; it is required
    // solely to force `JwtGuard` to authenticate the request.
    // The controller accepts it through `@CurrentUser` so a
    // missing token is rejected with 401 before the request
    // reaches the repository.
    const result = await this.reviewApplicationService.getReviewById(reviewId);
    return this.presenter.getReviewById(result);
  }
}
