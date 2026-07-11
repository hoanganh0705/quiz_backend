import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseFilters,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { ApiAuth, ApiPublicErrors } from '@/common/swagger/swagger-decorators';
import { ApiOkResource } from '@/common/swagger/api-ok';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { ReviewApplicationService } from '../../application/review.application.service';
import { HelpfulReviewDto, ReportReviewDto } from '../../dto/request';
import { HelpfulReviewResponseDto } from '../../dto/response/helpful-review-response.dto';
import { ReportReviewResponseDto } from '../../dto/response/report-review-response.dto';
import { ReviewDashboardResponseDto } from '../../dto/response/review-dashboard-response.dto';
import { ReviewDetailResponseDto } from '../../dto/response/review-detail-response.dto';
import { ReviewDomainErrorDto } from '../../dto/response/review-domain-error.dto';
import { ReviewDomainExceptionFilter } from '../filters/review-domain-exception.filter';
import { ReviewPresenter } from '../presenters/review.presenter';

// Local helpers — these decorators emit the response schemas that match the
// actual runtime error shapes produced by ReviewDomainExceptionFilter:
//
//   { statusCode: number, message: string, error: string }
//
// Use these for any 400 / 404 / 409 produced by a review domain error.
// (401, 403, 500 are emitted by GlobalExceptionFilter as RFC 7807
// ProblemDetail and are handled by ApiAuth / ApiPublicErrors.)

const reviewNotFoundResponse = (description: string = 'Review not found') =>
  ApiNotFoundResponse({ description, type: ReviewDomainErrorDto });

const reviewConflictResponse = (description: string = 'You have already reported this review') =>
  ApiConflictResponse({ description, type: ReviewDomainErrorDto });

const reviewBadRequestResponse = (description: string = 'You cannot vote on your own review') =>
  ApiBadRequestResponse({ description, type: ReviewDomainErrorDto });

@ApiTags('reviews')
@Controller('reviews')
@UseFilters(ReviewDomainExceptionFilter)
export class ReviewController {
  constructor(
    private readonly reviewApplicationService: ReviewApplicationService,
    private readonly presenter: ReviewPresenter,
  ) {}

  @Get('me')
  @ApiAuth()
  @ApiOkResource(ReviewDashboardResponseDto, { description: 'Review dashboard returned' })
  async getMyReviewDashboard(@CurrentUser() user: JwtPayload) {
    const result = await this.reviewApplicationService.getMyReviewDashboard(user);
    return this.presenter.getMyReviewDashboard(result);
  }

  @Post(':reviewId/helpful')
  @ApiAuth()
  @ApiOkResource(HelpfulReviewResponseDto, { description: 'Helpful vote recorded' })
  @reviewNotFoundResponse()
  @reviewBadRequestResponse()
  async markReviewHelpful(
    @Param('reviewId', new ParseUUIDPipe()) reviewId: string,
    @CurrentUser() user: JwtPayload,
    @Body() payload: HelpfulReviewDto,
  ) {
    const result = await this.reviewApplicationService.markReviewHelpful(reviewId, payload, user);
    return this.presenter.markReviewHelpful(result);
  }

  @Delete(':reviewId/helpful')
  @ApiAuth()
  @ApiOkResource(HelpfulReviewResponseDto, { description: 'Helpful vote removed' })
  @reviewNotFoundResponse()
  async removeHelpfulVote(
    @Param('reviewId', new ParseUUIDPipe()) reviewId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.reviewApplicationService.removeHelpfulVote(reviewId, user);
    return this.presenter.removeHelpfulVote(result);
  }

  @Post(':reviewId/report')
  @ApiAuth()
  @ApiOkResource(ReportReviewResponseDto, { description: 'Review reported successfully' })
  @reviewNotFoundResponse()
  @reviewConflictResponse()
  async reportReview(
    @Param('reviewId', new ParseUUIDPipe()) reviewId: string,
    @CurrentUser() user: JwtPayload,
    @Body() payload: ReportReviewDto,
  ) {
    const result = await this.reviewApplicationService.reportReview(reviewId, user, payload);
    return this.presenter.reportReview(result);
  }

  @Get(':reviewId')
  @Public()
  @ApiPublicErrors()
  @ApiOkResource(ReviewDetailResponseDto, { description: 'Review detail returned' })
  @reviewNotFoundResponse()
  async getReviewById(@Param('reviewId', new ParseUUIDPipe()) reviewId: string) {
    const result = await this.reviewApplicationService.getReviewById(reviewId);
    return this.presenter.getReviewById(result);
  }
}
