import { Injectable } from '@nestjs/common';
import {
  ReviewResponseDto,
  CreateReviewResponseDto,
  UpdateReviewResponseDto,
} from '../dto/response';
import type { ReviewDetailRow, ReviewRow } from '../domain/ports';

@Injectable()
export class ReviewResponseMapper {
  toReviewResponse(row: ReviewDetailRow): ReviewResponseDto {
    return {
      reviewId: row.reviewId,
      quizId: row.quizId,
      userId: row.userId,
      username: row.username,
      userAvatarUrl: row.userAvatarUrl,
      rating: row.rating,
      comment: row.comment,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  toReviewResponses(rows: ReviewDetailRow[]): ReviewResponseDto[] {
    return rows.map((row) => this.toReviewResponse(row));
  }

  toCreateReviewResponse(row: ReviewRow): CreateReviewResponseDto {
    return {
      reviewId: row.reviewId,
      quizId: row.quizId,
      rating: row.rating,
      comment: row.comment,
      createdAt: row.createdAt,
    };
  }

  toUpdateReviewResponse(row: ReviewRow): UpdateReviewResponseDto {
    return {
      reviewId: row.reviewId,
      quizId: row.quizId,
      rating: row.rating,
      comment: row.comment,
      updatedAt: row.updatedAt,
    };
  }
}
