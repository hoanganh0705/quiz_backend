export class BookmarkedQuizResponseDto {
  bookmarkId!: string;
  quizId!: string;
  quizTitle!: string;
  quizSlug!: string;
  quizImageUrl!: string | null;
  quizIsFeatured!: boolean;
  quizDifficulty!: string | null;
  notes!: string | null;
  bookmarkedAt!: string;
}

export class BookmarkCollectionResponseDto {
  collectionId!: string;
  userId!: string;
  name!: string;
  description!: string | null;
  quizCount!: number;
  createdAt!: string;
  updatedAt!: string;
}

export class BookmarkCollectionListResponseDto {
  items!: BookmarkCollectionResponseDto[];
}

export class BookmarkListResponseDto {
  items!: BookmarkedQuizResponseDto[];
}

export class CreateCollectionResponseDto {
  collectionId!: string;
  name!: string;
  description!: string | null;
  createdAt!: string;
}

export class AddBookmarkResponseDto {
  bookmarkId!: string;
  collectionId!: string;
  quizId!: string;
  notes!: string | null;
  bookmarkedAt!: string;
}

export class RemoveBookmarkResponseDto {
  message!: string;
}
