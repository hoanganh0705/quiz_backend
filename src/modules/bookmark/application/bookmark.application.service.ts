import { Injectable } from '@nestjs/common';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { BookmarkService } from '../domain/bookmark.service';
import { BookmarkResponseMapper } from '../mappers/bookmark-response.mapper';
import { CreateCollectionDto, AddBookmarkDto, UpdateCollectionDto } from '../dto/request';

import {
  BookmarkCollectionListResponseDto,
  CreateCollectionResponseDto,
  AddBookmarkResponseDto,
  BookmarkListResponseDto,
  RemoveBookmarkResponseDto,
  UpdateCollectionResponseDto,
  DeleteCollectionResponseDto,
} from '../dto/response';

@Injectable()
export class BookmarkApplicationService {
  constructor(
    private readonly bookmarkService: BookmarkService,
    private readonly bookmarkResponseMapper: BookmarkResponseMapper,
  ) {}

  async listCollections(user: JwtPayload): Promise<BookmarkCollectionListResponseDto> {
    const rows = await this.bookmarkService.listCollections(user);

    return {
      items: rows.map((row) => this.bookmarkResponseMapper.toCollectionResponse(row)),
    };
  }

  async createCollection(
    user: JwtPayload,
    payload: CreateCollectionDto,
  ): Promise<CreateCollectionResponseDto> {
    const collection = await this.bookmarkService.createCollection(
      user,
      payload.name,
      payload.description,
    );

    return this.bookmarkResponseMapper.toCreateCollectionResponse(collection);
  }

  async addBookmark(
    collectionId: string,
    payload: AddBookmarkDto,
    user: JwtPayload,
  ): Promise<AddBookmarkResponseDto> {
    const bookmark = await this.bookmarkService.addBookmark(
      collectionId,
      payload.quizId,
      payload.notes,
      user,
    );

    return this.bookmarkResponseMapper.toAddBookmarkResponse(bookmark);
  }

  async removeBookmark(
    collectionId: string,
    quizId: string,
    user: JwtPayload,
  ): Promise<RemoveBookmarkResponseDto> {
    await this.bookmarkService.removeBookmark(collectionId, quizId, user);

    return { message: 'Bookmark removed successfully' };
  }

  async listBookmarksInCollection(
    collectionId: string,
    user: JwtPayload,
  ): Promise<BookmarkListResponseDto> {
    const rows = await this.bookmarkService.listBookmarksInCollection(collectionId, user);

    return {
      items: rows.map((row) => this.bookmarkResponseMapper.toBookmarkedQuizResponse(row)),
    };
  }

  async updateCollection(
    collectionId: string,
    payload: UpdateCollectionDto,
    user: JwtPayload,
  ): Promise<UpdateCollectionResponseDto> {
    const collection = await this.bookmarkService.updateCollection(
      collectionId,
      user,
      payload.name,
      payload.description,
    );

    return this.bookmarkResponseMapper.toUpdateCollectionResponse(collection);
  }

  async deleteCollection(
    collectionId: string,
    user: JwtPayload,
  ): Promise<DeleteCollectionResponseDto> {
    await this.bookmarkService.deleteCollection(collectionId, user);

    return { message: 'Collection deleted successfully' };
  }
}
