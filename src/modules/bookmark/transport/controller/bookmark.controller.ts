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
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
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

@ApiTags('bookmarks')
@ApiBearerAuth()
@Controller('bookmarks')
@UseFilters(BookmarkDomainExceptionFilter)
export class BookmarkController {
  constructor(private readonly bookmarkApplicationService: BookmarkApplicationService) {}

  @Get('collections')
  @ApiOperation({
    summary: 'List my collections',
    description: 'Returns all bookmark collections owned by the authenticated user.',
  })
  @ApiOkResponse({ description: 'Collections returned', type: BookmarkCollectionListResponseDto })
  async listCollections(
    @CurrentUser() user: JwtPayload,
  ): Promise<BookmarkCollectionListResponseDto> {
    return this.bookmarkApplicationService.listCollections(user);
  }

  @Post('collections')
  @ApiOperation({
    summary: 'Create collection',
    description: 'Creates a new bookmark collection for the authenticated user.',
  })
  @ApiCreatedResponse({ description: 'Collection created', type: CreateCollectionResponseDto })
  async createCollection(
    @CurrentUser() user: JwtPayload,
    @Body() payload: CreateCollectionDto,
  ): Promise<CreateCollectionResponseDto> {
    return this.bookmarkApplicationService.createCollection(user, payload);
  }

  @Get('collections/:collectionId')
  @ApiOperation({
    summary: 'List bookmarks in collection',
    description: 'Returns all bookmarked quizzes within a specific collection.',
  })
  @ApiOkResponse({ description: 'Bookmarks returned', type: BookmarkListResponseDto })
  async listBookmarksInCollection(
    @Param('collectionId', new ParseUUIDPipe()) collectionId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<BookmarkListResponseDto> {
    return this.bookmarkApplicationService.listBookmarksInCollection(collectionId, user);
  }

  @Post('collections/:collectionId/quizzes')
  @ApiOperation({ summary: 'Add bookmark', description: 'Adds a quiz to a bookmark collection.' })
  @ApiCreatedResponse({ description: 'Bookmark added', type: AddBookmarkResponseDto })
  async addBookmark(
    @Param('collectionId', new ParseUUIDPipe()) collectionId: string,
    @CurrentUser() user: JwtPayload,
    @Body() payload: AddBookmarkDto,
  ): Promise<AddBookmarkResponseDto> {
    return this.bookmarkApplicationService.addBookmark(collectionId, payload, user);
  }

  @Delete('collections/:collectionId/quizzes/:quizId')
  @ApiOperation({
    summary: 'Remove bookmark',
    description: 'Removes a quiz from a bookmark collection.',
  })
  @ApiOkResponse({ description: 'Bookmark removed', type: RemoveBookmarkResponseDto })
  async removeBookmark(
    @Param('collectionId', new ParseUUIDPipe()) collectionId: string,
    @Param('quizId', new ParseUUIDPipe()) quizId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<RemoveBookmarkResponseDto> {
    return this.bookmarkApplicationService.removeBookmark(collectionId, quizId, user);
  }
}
