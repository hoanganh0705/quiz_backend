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
import { ApiTags, ApiNotFoundResponse } from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import {
  ApiAuthList,
  ApiAuthCreate,
  ApiAuthUpdate,
  ApiAuthDelete,
  ApiPublicList,
  ApiInternalError,
} from '@/common/swagger/swagger-decorators';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { ReviewApplicationService } from '../../application/review.application.service';
import { CreateReviewDto, UpdateReviewDto, ListReviewsQueryDto } from '../../dto/request';
import {
  ReviewListResponseDto,
  CreateReviewResponseDto,
  UpdateReviewResponseDto,
  DeleteReviewResponseDto,
  ReviewDetailResponseDto,
  ReviewStatsResponseDto,
} from '../../dto/response';
import { QuizAnalyticsResponseDto } from '@/modules/quiz/dto/response/quiz-analytics.dto';
import { ReviewDomainExceptionFilter } from '../filters/review-domain-exception.filter';
import { CursorMapper } from '../../mappers/review-cursor.mapper';

@ApiTags('quizzes')
@Controller('quizzes')
@UseFilters(ReviewDomainExceptionFilter)
export class quizReviewController {
  constructor(private readonly reviewApplicationService: ReviewApplicationService) {}

  @Post(':quizId/reviews')
  @ApiAuthCreate({ description: 'Review created', type: CreateReviewResponseDto })
  async createReview(
    @Param('quizId', new ParseUUIDPipe()) quizId: string,
    @CurrentUser() user: JwtPayload,
    @Body() payload: CreateReviewDto,
  ): Promise<CreateReviewResponseDto> {
    return this.reviewApplicationService.createReview(quizId, payload, user);
  }

  @Get(':quizId/reviews')
  @Public()
  @ApiPublicList({ description: 'Reviews returned', type: ReviewListResponseDto })
  async listReviews(
    @Param('quizId', new ParseUUIDPipe()) quizId: string,
    @Query() query: ListReviewsQueryDto,
  ): Promise<ReviewListResponseDto> {
    const limit = query.limit ?? 20;
    const cursor = query.cursor ? CursorMapper.parseReview(query.cursor) : null;
    return this.reviewApplicationService.listReviews(
      quizId,
      limit,
      cursor,
      query.rating,
      query.sort,
    );
  }

  @Get(':quizId/reviews/stats')
  @Public()
  @ApiPublicList({ description: 'Quiz review statistics returned', type: ReviewStatsResponseDto })
  async getQuizReviewStats(
    @Param('quizId', new ParseUUIDPipe()) quizId: string,
  ): Promise<ReviewStatsResponseDto> {
    return this.reviewApplicationService.getQuizReviewStats(quizId);
  }

  @Get(':quizId/reviews/analytics')
  @ApiAuthList({ description: 'Quiz review analytics returned', type: QuizAnalyticsResponseDto })
  @ApiNotFoundResponse()
  @ApiInternalError()
  async getCreatorQuizReviewAnalytics(
    @Param('quizId', new ParseUUIDPipe()) quizId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<QuizAnalyticsResponseDto> {
    return this.reviewApplicationService.getCreatorQuizReviewAnalytics(quizId, user);
  }

  @Get(':quizId/reviews/me')
  @ApiAuthList({
    description: 'My review returned (or null if no review)',
    type: ReviewDetailResponseDto,
  })
  @ApiNotFoundResponse()
  @ApiInternalError()
  async getMyQuizReview(
    @Param('quizId', new ParseUUIDPipe()) quizId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ReviewDetailResponseDto | null> {
    return this.reviewApplicationService.getMyQuizReview(quizId, user.sub);
  }

  @Patch(':quizId/reviews')
  @ApiAuthUpdate({ description: 'Review updated', type: UpdateReviewResponseDto })
  async updateReview(
    @Param('quizId', new ParseUUIDPipe()) quizId: string,
    @CurrentUser() user: JwtPayload,
    @Body() payload: UpdateReviewDto,
  ): Promise<UpdateReviewResponseDto> {
    return this.reviewApplicationService.updateReview(quizId, payload, user);
  }

  @Delete(':quizId/reviews')
  @ApiAuthDelete('Review deleted')
  async deleteReview(
    @Param('quizId', new ParseUUIDPipe()) quizId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<DeleteReviewResponseDto> {
    return this.reviewApplicationService.deleteReview(quizId, user);
  }
}
