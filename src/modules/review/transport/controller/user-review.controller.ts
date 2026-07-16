import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
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
  @ApiListMyReportedReviewsResponses()
  async listMyReportedReviews(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListReportedReviewsQueryDto,
  ) {
    const result = await this.reviewApplicationService.listReportedReviews(user.sub, {
      limit: query.limit,
      cursor: query.cursor ? CursorMapper.parseReport(query.cursor) : null,
    });
    return this.presenter.listMyReportedReviews(result);
  }

  @Get('me/reviews')
  @ApiAuth()
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
  @ApiGetMyReviewForQuizResponses()
  async getMyReviewForQuiz(
    @Param('quizId', new ParseUUIDPipe()) quizId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.reviewApplicationService.getMyQuizReview(quizId, user.sub);
    return this.presenter.getMyQuizReview(result);
  }

  @Get(':userId/reviews')
  @Public()
  @ApiListReviewsByUserResponses()
  async listReviewsByUser(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Query() query: ListMyReviewsQueryDto,
  ) {
    const result = await this.reviewApplicationService.listReviewsByUser(userId, {
      limit: query.limit,
      cursor: query.cursor ? CursorMapper.parseReview(query.cursor) : null,
    });
    return this.presenter.listReviewsByUser(result);
  }
}
