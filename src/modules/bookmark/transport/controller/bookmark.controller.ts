import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseFilters,
} from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { BookmarkApplicationService } from '../../application/bookmark.application.service';
import { CreateCollectionDto, AddBookmarkDto } from '../../dto/request';
import {
  BookmarkCollectionListResponseDto,
  CreateCollectionResponseDto,
  AddBookmarkResponseDto,
  RemoveBookmarkResponseDto,
  BookmarkListResponseDto,
} from '../../dto/response';
import { BookmarkDomainExceptionFilter } from '../filters/bookmark-domain-exception.filter';

@Controller('bookmarks')
@UseFilters(BookmarkDomainExceptionFilter)
export class BookmarkController {
  constructor(private readonly bookmarkApplicationService: BookmarkApplicationService) {}

  @Get('collections')
  async listCollections(
    @CurrentUser() user: JwtPayload,
  ): Promise<BookmarkCollectionListResponseDto> {
    return this.bookmarkApplicationService.listCollections(user);
  }

  @Post('collections')
  async createCollection(
    @CurrentUser() user: JwtPayload,
    @Body() payload: CreateCollectionDto,
  ): Promise<CreateCollectionResponseDto> {
    return this.bookmarkApplicationService.createCollection(user, payload);
  }

  @Get('collections/:collectionId')
  async listBookmarksInCollection(
    @Param('collectionId', new ParseUUIDPipe()) collectionId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<BookmarkListResponseDto> {
    return this.bookmarkApplicationService.listBookmarksInCollection(collectionId, user);
  }

  @Post('collections/:collectionId/quizzes')
  async addBookmark(
    @Param('collectionId', new ParseUUIDPipe()) collectionId: string,
    @CurrentUser() user: JwtPayload,
    @Body() payload: AddBookmarkDto,
  ): Promise<AddBookmarkResponseDto> {
    return this.bookmarkApplicationService.addBookmark(collectionId, payload, user);
  }

  @Delete('collections/:collectionId/quizzes/:quizId')
  async removeBookmark(
    @Param('collectionId', new ParseUUIDPipe()) collectionId: string,
    @Param('quizId', new ParseUUIDPipe()) quizId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<RemoveBookmarkResponseDto> {
    return this.bookmarkApplicationService.removeBookmark(collectionId, quizId, user);
  }
}
