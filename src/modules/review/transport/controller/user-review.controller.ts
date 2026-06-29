import { Body, Controller, Get, Param, ParseUUIDPipe, Query, UseFilters } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { ApiAuthList, ApiPublicList } from '@/common/swagger/swagger-decorators';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { ReviewApplicationService } from '../../application/review.application.service';
import { ListMyReviewsQueryDto, ListReportedReviewsQueryDto } from '../../dto/request';
import {
  MyReviewsResponseDto,
  ReportedReviewsResponseDto,
  ReviewDetailResponseDto,
} from '../../dto/response';
import { ReviewDomainExceptionFilter } from '../filters/review-domain-exception.filter';
import { CursorMapper } from '../../mappers/review-cursor.mapper';
import {
  WrappedMyReviewsListDto,
  WrappedReportedReviewsListDto,
  WrappedMyReviewDto,
} from '../../dto/response/review-response-docs.dto';

@ApiTags('users')
@Controller('users')
@UseFilters(ReviewDomainExceptionFilter)
export class UserReviewController {
  constructor(private readonly reviewApplicationService: ReviewApplicationService) {}

  @Get('me/reported-reviews')
  @ApiAuthList({ description: 'Reported reviews returned', type: WrappedReportedReviewsListDto })
  async listMyReportedReviews(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListReportedReviewsQueryDto,
  ): Promise<ReportedReviewsResponseDto> {
    return this.reviewApplicationService.listReportedReviews(user.sub, {
      limit: query.limit,
      cursor: query.cursor ? CursorMapper.parseReport(query.cursor) : null,
    });
  }

  @Get(':userId/reviews')
  @Public()
  @ApiPublicList({ description: 'User reviews returned', type: WrappedMyReviewsListDto })
  async listReviewsByUser(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Query() query: ListMyReviewsQueryDto,
  ): Promise<MyReviewsResponseDto> {
    return this.reviewApplicationService.listReviewsByUser(userId, {
      limit: query.limit,
      cursor: query.cursor ? CursorMapper.parseReview(query.cursor) : null,
    });
  }

  @Get('me/reviews')
  @ApiAuthList({ description: 'My reviews returned', type: WrappedMyReviewsListDto })
  async listMyReviews(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListMyReviewsQueryDto,
  ): Promise<MyReviewsResponseDto> {
    return this.reviewApplicationService.listUserReviews(user.sub, {
      limit: query.limit,
      cursor: query.cursor ? CursorMapper.parseReview(query.cursor) : null,
    });
  }

  // Implementation returns `null` when the user has not reviewed the quiz
  // (NOT a 404). The wrapper documents `data: ReviewDetailDataDto | null`.
  @Get('me/reviews/:quizId')
  @ApiAuthList({ description: 'My review for the quiz returned', type: WrappedMyReviewDto })
  async getMyReviewForQuiz(
    @Param('quizId', new ParseUUIDPipe()) quizId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ReviewDetailResponseDto | null> {
    return this.reviewApplicationService.getMyQuizReview(quizId, user.sub);
  }
}
