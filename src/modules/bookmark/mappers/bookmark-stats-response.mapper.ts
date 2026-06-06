import { Injectable } from '@nestjs/common';
import type { UserBookmarkStatsRow } from '../domain/ports';
import type { BookmarkStatsResponseDto } from '../dto/response';

@Injectable()
export class BookmarkStatsResponseMapper {
  toResponse(row: UserBookmarkStatsRow): BookmarkStatsResponseDto {
    return {
      totalCollections: row.totalCollections,
      totalBookmarks: row.totalBookmarks,
      favoriteCategory: row.favoriteCategory,
      favoriteTag: row.favoriteTag,
    };
  }
}
