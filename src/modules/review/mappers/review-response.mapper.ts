import { Injectable } from '@nestjs/common';
import {
  ReviewResponseDto,
  CreateReviewResponseDto,
  UpdateReviewResponseDto,
  MyReviewItemDto,
  ReviewDetailResponseDto,
} from '../dto/response';
import type { ReviewDetailRow, ReviewRow, MyReviewRow, ReviewDetailByIdRow } from '../domain/ports';

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

  toMyReviewItem(row: MyReviewRow): MyReviewItemDto {
    return {
      reviewId: row.reviewId,
      quizId: row.quizId,
      quizTitle: row.quizTitle,
      rating: row.rating,
      content: row.content,
      createdAt: row.createdAt,
    };
  }

  toMyReviewItems(rows: MyReviewRow[]): MyReviewItemDto[] {
    return rows.map((row) => this.toMyReviewItem(row));
  }

  toReviewDetailResponse(row: ReviewDetailByIdRow): ReviewDetailResponseDto {
    return {
      reviewId: row.reviewId,
      quizId: row.quizId,
      quizTitle: row.quizTitle,
      userId: row.userId,
      username: row.username,
      rating: row.rating,
      content: row.content,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
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
