import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
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
  @ApiOperation({ summary: 'Remove the helpful vote on a review' })
  @ApiRemoveHelpfulVoteResponses()
  async removeHelpfulVote(
    @Param('reviewId', new ParseUUIDPipe({ version: '7' })) reviewId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.reviewApplicationService.removeHelpfulVote(reviewId, user);
    return this.presenter.removeHelpfulVote(result);
  }

  @Post(':reviewId/report')
  @ApiAuth()
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
  @Public()
  @ApiOperation({ summary: 'Get a review by ID' })
  @ApiGetReviewByIdResponses()
  async getReviewById(@Param('reviewId', new ParseUUIDPipe({ version: '7' })) reviewId: string) {
    const result = await this.reviewApplicationService.getReviewById(reviewId);
    return this.presenter.getReviewById(result);
  }
}
