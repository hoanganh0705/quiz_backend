import { Injectable } from '@nestjs/common';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { ReviewService } from '../domain/review.service';
import { ReviewResponseMapper } from '../mappers/review-response.mapper';
import { CreateReviewDto, UpdateReviewDto } from '../dto/request';
import {
  ReviewListResponseDto,
  CreateReviewResponseDto,
  UpdateReviewResponseDto,
  DeleteReviewResponseDto,
} from '../dto/response';

@Injectable()
export class ReviewApplicationService {
  constructor(
    private readonly reviewService: ReviewService,
    private readonly reviewResponseMapper: ReviewResponseMapper,
  ) {}

  async createReview(
    quizId: string,
    payload: CreateReviewDto,
    user: JwtPayload,
  ): Promise<CreateReviewResponseDto> {
    const review = await this.reviewService.createReview(
      quizId,
      payload.rating,
      payload.comment,
      user,
    );

    return this.reviewResponseMapper.toCreateReviewResponse(review);
  }

  async listReviews(
    quizId: string,
    limit: number,
    cursor?: { createdAt: string; reviewId: string } | null,
  ): Promise<ReviewListResponseDto> {
    const rows = await this.reviewService.listReviews(quizId, limit, cursor);

    const hasNextPage = rows.length > limit;
    const items = hasNextPage ? rows.slice(0, limit) : rows;
    const lastItem = items.at(-1);

    return {
      items: this.reviewResponseMapper.toReviewResponses(items),
      pagination: {
        limit,
        hasNextPage,
        nextCursor:
          hasNextPage && lastItem
            ? Buffer.from(
                JSON.stringify({
                  createdAt: lastItem.createdAt,
                  reviewId: lastItem.reviewId,
                }),
              ).toString('base64')
            : null,
      },
    };
  }

  async updateReview(
    quizId: string,
    payload: UpdateReviewDto,
    user: JwtPayload,
  ): Promise<UpdateReviewResponseDto> {
    const review = await this.reviewService.updateReview(
      quizId,
      payload.rating,
      payload.comment,
      user,
    );

    return this.reviewResponseMapper.toUpdateReviewResponse(review);
  }

  async deleteReview(quizId: string, user: JwtPayload): Promise<DeleteReviewResponseDto> {
    await this.reviewService.deleteReview(quizId, user);

    return { message: 'Review deleted successfully' };
  }
}
