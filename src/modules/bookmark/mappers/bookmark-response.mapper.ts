import { Injectable } from '@nestjs/common';
import {
  BookmarkCollectionResponseDto,
  BookmarkedQuizResponseDto,
  CreateCollectionResponseDto,
  AddBookmarkResponseDto,
  UpdateCollectionResponseDto,
} from '../dto/response';

import type {
  BookmarkCollectionRow,
  BookmarkCollectionWithCountRow,
  BookmarkedQuizRow,
  BookmarkedQuizDetailRow,
} from '../domain/ports';

@Injectable()
export class BookmarkResponseMapper {
  toCollectionResponse(row: BookmarkCollectionWithCountRow): BookmarkCollectionResponseDto {
    return {
      collectionId: row.collectionId,
      userId: row.userId,
      name: row.name,
      description: row.description,
      quizCount: row.quizCount,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  toCreateCollectionResponse(row: BookmarkCollectionRow): CreateCollectionResponseDto {
    return {
      collectionId: row.collectionId,
      name: row.name,
      description: row.description,
      createdAt: row.createdAt,
    };
  }

  toAddBookmarkResponse(row: BookmarkedQuizRow): AddBookmarkResponseDto {
    return {
      bookmarkId: row.bookmarkId,
      collectionId: row.collectionId,
      quizId: row.quizId,
      notes: row.notes,
      bookmarkedAt: row.bookmarkedAt,
    };
  }

  toBookmarkedQuizResponse(row: BookmarkedQuizDetailRow): BookmarkedQuizResponseDto {
    return {
      bookmarkId: row.bookmarkId,
      quizId: row.quizId,
      quizTitle: row.quizTitle,
      quizSlug: row.quizSlug,
      quizImageUrl: row.quizImageUrl,
      quizIsFeatured: row.quizIsFeatured,
      quizDifficulty: row.quizDifficulty,
      notes: row.notes,
      bookmarkedAt: row.bookmarkedAt,
    };
  }

  toUpdateCollectionResponse(row: BookmarkCollectionRow): UpdateCollectionResponseDto {
    return {
      collectionId: row.collectionId,
      name: row.name,
      description: row.description,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
