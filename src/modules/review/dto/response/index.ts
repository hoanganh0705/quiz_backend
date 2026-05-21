export class ReviewResponseDto {
  reviewId!: string;
  quizId!: string;
  userId!: string;
  username!: string;
  userAvatarUrl!: string | null;
  rating!: number;
  comment!: string | null;
  createdAt!: string;
  updatedAt!: string;
}

export class ReviewListResponseDto {
  items!: ReviewResponseDto[];
  pagination!: {
    limit: number;
    nextCursor: string | null;
    hasNextPage: boolean;
  };
}

export class CreateReviewResponseDto {
  reviewId!: string;
  quizId!: string;
  rating!: number;
  comment!: string | null;
  createdAt!: string;
}

export class UpdateReviewResponseDto {
  reviewId!: string;
  quizId!: string;
  rating!: number;
  comment!: string | null;
  updatedAt!: string;
}

export class DeleteReviewResponseDto {
  message!: string;
}
