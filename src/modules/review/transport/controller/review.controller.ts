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
import { ApiTags, ApiInternalServerErrorResponse, ApiNotFoundResponse } from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { ApiAuthList, ApiAuthAction, ApiPublicList } from '@/common/swagger/swagger-decorators';
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
  WrappedReviewDetailDto,
  WrappedMyDashboardDto,
  WrappedHelpfulMessageDto,
  WrappedReportMessageDto,
} from '../../dto/response/review-response-docs.dto';

@ApiTags('reviews')
@Controller('reviews')
@UseFilters(ReviewDomainExceptionFilter)
export class ReviewController {
  constructor(private readonly reviewApplicationService: ReviewApplicationService) {}

  @Get('me')
  @ApiAuthList({ description: 'Review dashboard returned', type: WrappedMyDashboardDto })
  @ApiInternalServerErrorResponse()
  async getMyReviewDashboard(@CurrentUser() user: JwtPayload): Promise<ReviewDashboardResponseDto> {
    return this.reviewApplicationService.getMyReviewDashboard(user);
  }

  @Post(':reviewId/helpful')
  @ApiAuthAction({ description: 'Helpful vote recorded', type: WrappedHelpfulMessageDto })
  async markReviewHelpful(
    @Param('reviewId', new ParseUUIDPipe()) reviewId: string,
    @CurrentUser() user: JwtPayload,
    @Body() payload: HelpfulReviewDto,
  ): Promise<HelpfulReviewResponseDto> {
    return this.reviewApplicationService.markReviewHelpful(reviewId, payload, user);
  }

  @Delete(':reviewId/helpful')
  @ApiAuthList({ description: 'Helpful vote removed', type: WrappedHelpfulMessageDto })
  @ApiNotFoundResponse({ description: 'Review not found' })
  async removeHelpfulVote(
    @Param('reviewId', new ParseUUIDPipe()) reviewId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<HelpfulReviewResponseDto> {
    return this.reviewApplicationService.removeHelpfulVote(reviewId, user);
  }

  @Post(':reviewId/report')
  @ApiAuthAction({ description: 'Review reported successfully', type: WrappedReportMessageDto })
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
  @ApiNotFoundResponse({ description: 'Review not found' })
  async getReviewById(
    @Param('reviewId', new ParseUUIDPipe()) reviewId: string,
  ): Promise<ReviewDetailResponseDto> {
    return this.reviewApplicationService.getReviewById(reviewId);
  }
}
