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
  ApiTags,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
  ApiConflictResponse,
} from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { ApiAuthList, ApiPublicList } from '@/common/swagger/swagger-decorators';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { ReviewApplicationService } from '../../application/review.application.service';
import { HelpfulReviewDto, ReportReviewDto } from '../../dto/request';
import {
  ReviewDetailResponseDto,
  ReviewDashboardResponseDto,
  HelpfulReviewResponseDto,
  ReportReviewResponseDto,
} from '../../dto/response';
import { ReviewDomainExceptionFilter } from '../filters/review-domain-exception.filter';
import {
  ReviewDomainErrorDto,
  WrappedReviewDetailDto,
  WrappedMyDashboardDto,
  WrappedHelpfulMessageDto,
  WrappedReportMessageDto,
} from '../../dto/response/review-response-docs.dto';

// Local helpers — these decorators emit the response schemas that match the
// actual runtime error shapes produced by ReviewDomainExceptionFilter:
//
//   { statusCode: number, message: string, error: string }
//
// Use these for any 400 / 404 / 409 produced by a review domain error.
// (401, 403, 500 are emitted by GlobalExceptionFilter as RFC 7807
// ProblemDetail and are handled by the generic ApiAuth / ApiAuthList /
// ApiPublicList decorators.)

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
  constructor(private readonly reviewApplicationService: ReviewApplicationService) {}

  @Get('me')
  @ApiAuthList({ description: 'Review dashboard returned', type: WrappedMyDashboardDto })
  async getMyReviewDashboard(@CurrentUser() user: JwtPayload): Promise<ReviewDashboardResponseDto> {
    return this.reviewApplicationService.getMyReviewDashboard(user);
  }

  @Post(':reviewId/helpful')
  @ApiAuthList({ description: 'Helpful vote recorded', type: WrappedHelpfulMessageDto })
  @reviewNotFoundResponse()
  @reviewBadRequestResponse()
  async markReviewHelpful(
    @Param('reviewId', new ParseUUIDPipe()) reviewId: string,
    @CurrentUser() user: JwtPayload,
    @Body() payload: HelpfulReviewDto,
  ): Promise<HelpfulReviewResponseDto> {
    return this.reviewApplicationService.markReviewHelpful(reviewId, payload, user);
  }

  @Delete(':reviewId/helpful')
  @ApiAuthList({ description: 'Helpful vote removed', type: WrappedHelpfulMessageDto })
  @reviewNotFoundResponse()
  async removeHelpfulVote(
    @Param('reviewId', new ParseUUIDPipe()) reviewId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<HelpfulReviewResponseDto> {
    return this.reviewApplicationService.removeHelpfulVote(reviewId, user);
  }

  @Post(':reviewId/report')
  @ApiAuthList({ description: 'Review reported successfully', type: WrappedReportMessageDto })
  @reviewNotFoundResponse()
  @reviewConflictResponse()
  async reportReview(
    @Param('reviewId', new ParseUUIDPipe()) reviewId: string,
    @CurrentUser() user: JwtPayload,
    @Body() payload: ReportReviewDto,
  ): Promise<ReportReviewResponseDto> {
    return this.reviewApplicationService.reportReview(reviewId, user, payload);
  }

  @Get(':reviewId')
  @Public()
  @ApiPublicList({ description: 'Review detail returned', type: WrappedReviewDetailDto })
  @reviewNotFoundResponse()
  async getReviewById(
    @Param('reviewId', new ParseUUIDPipe()) reviewId: string,
  ): Promise<ReviewDetailResponseDto> {
    return this.reviewApplicationService.getReviewById(reviewId);
  }
}
