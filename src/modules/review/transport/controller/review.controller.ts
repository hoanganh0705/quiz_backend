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
} from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { ApiAuth, ApiValidationRequest } from '@/common/swagger/swagger-decorators';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { ReviewApplicationService } from '../../application/review.application.service';
import {
  HelpfulReviewDto,
  ReportReviewDto,
} from '../../dto/request';
import {
  ReviewDetailResponseDto,
  ReviewDashboardResponseDto,
  HelpfulReviewResponseDto,
  ReportReviewResponseDto,
} from '../../dto/response';
import { ReviewDomainExceptionFilter } from '../filters/review-domain-exception.filter';

@ApiTags('reviews')
@ApiBearerAuth()
@Controller('reviews')
@UseFilters(ReviewDomainExceptionFilter)
export class ReviewController {
  constructor(private readonly reviewApplicationService: ReviewApplicationService) {}

  @Get('me')
  @ApiAuth()
  @ApiOperation({
    summary: 'Get my review dashboard',
    description: 'Returns the authenticated user\'s review dashboard summary.',
  })
  @ApiOkResponse({ description: 'Review dashboard returned', type: ReviewDashboardResponseDto })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  async getMyReviewDashboard(
    @CurrentUser() user: JwtPayload,
  ): Promise<ReviewDashboardResponseDto> {
    return this.reviewApplicationService.getMyReviewDashboard(user);
  }

  @Post(':reviewId/helpful')
  @ApiAuth()
  @ApiOperation({
    summary: 'Mark review as helpful',
    description: 'Marks a review as helpful for the authenticated user. Idempotent.',
  })
  @ApiOkResponse({ description: 'Helpful vote recorded', type: HelpfulReviewResponseDto })
  @ApiNotFoundResponse({ description: 'Review not found' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  @ApiValidationRequest()
  async markReviewHelpful(
    @Param('reviewId', new ParseUUIDPipe()) reviewId: string,
    @CurrentUser() user: JwtPayload,
    @Body() payload: HelpfulReviewDto,
  ): Promise<HelpfulReviewResponseDto> {
    return this.reviewApplicationService.markReviewHelpful(reviewId, payload, user);
  }

  @Delete(':reviewId/helpful')
  @ApiAuth()
  @ApiOperation({
    summary: 'Remove helpful vote',
    description: 'Removes the authenticated user\'s helpful vote from a review. Idempotent.',
  })
  @ApiOkResponse({ description: 'Helpful vote removed', type: HelpfulReviewResponseDto })
  @ApiNotFoundResponse({ description: 'Review not found' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  async removeHelpfulVote(
    @Param('reviewId', new ParseUUIDPipe()) reviewId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<HelpfulReviewResponseDto> {
    return this.reviewApplicationService.removeHelpfulVote(reviewId, user);
  }

  @Post(':reviewId/report')
  @ApiAuth()
  @ApiOperation({
    summary: 'Report review',
    description: 'Reports an inappropriate review for moderation.',
  })
  @ApiOkResponse({ description: 'Review reported successfully', type: ReportReviewResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiNotFoundResponse({ description: 'Review not found' })
  @ApiConflictResponse({ description: 'You have already reported this review' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  @ApiValidationRequest()
  async reportReview(
    @Param('reviewId', new ParseUUIDPipe()) reviewId: string,
    @CurrentUser() user: JwtPayload,
    @Body() payload: ReportReviewDto,
  ): Promise<ReportReviewResponseDto> {
    return this.reviewApplicationService.reportReview(reviewId, user, payload);
  }

  @Get(':reviewId')
  @Public()
  @ApiOperation({
    summary: 'Get review detail',
    description: 'Returns detailed information about a specific review by review ID.',
  })
  @ApiOkResponse({
    description: 'Review detail returned',
    type: ReviewDetailResponseDto,
    schema: {
      example: {
        reviewId: '550e8400-e29b-41d4-a716-446655440099',
        quizId: '660e8400-e29b-41d4-a716-446655440000',
        quizTitle: 'JavaScript Fundamentals',
        userId: '770e8400-e29b-41d4-a716-446655440000',
        username: 'Anh',
        rating: 5,
        content: 'Excellent quiz',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Review not found' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  async getReviewById(
    @Param('reviewId', new ParseUUIDPipe()) reviewId: string,
  ): Promise<ReviewDetailResponseDto> {
    return this.reviewApplicationService.getReviewById(reviewId);
  }
}
