import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseFilters,
} from '@nestjs/common';

import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiConflictResponse,
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
} from '@nestjs/swagger';

import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { ApiAuth, ApiValidationRequest } from '@/common/swagger/swagger-decorators';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { BookmarkApplicationService } from '../../application/bookmark.application.service';
import { CreateCollectionDto, AddBookmarkDto, UpdateCollectionDto } from '../../dto/request';

import {
  BookmarkCollectionListResponseDto,
  CreateCollectionResponseDto,
  AddBookmarkResponseDto,
  RemoveBookmarkResponseDto,
  BookmarkListResponseDto,
  UpdateCollectionResponseDto,
  DeleteCollectionResponseDto,
} from '../../dto/response';

import { BookmarkDomainExceptionFilter } from '../filters/bookmark-domain-exception.filter';

@ApiTags('bookmarks')
@ApiBearerAuth()
@Controller('bookmarks')
@UseFilters(BookmarkDomainExceptionFilter)
export class BookmarkController {
  constructor(private readonly bookmarkApplicationService: BookmarkApplicationService) {}

  @Get('collections')
  @ApiAuth()
  @ApiOperation({
    summary: 'List my collections',
    description: 'Returns all bookmark collections owned by the authenticated user.',
  })
  @ApiOkResponse({ description: 'Collections returned', type: BookmarkCollectionListResponseDto })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  async listCollections(
    @CurrentUser() user: JwtPayload,
  ): Promise<BookmarkCollectionListResponseDto> {
    return this.bookmarkApplicationService.listCollections(user);
  }

  @Post('collections')
  @ApiAuth()
  @ApiOperation({
    summary: 'Create collection',
    description: 'Creates a new bookmark collection for the authenticated user.',
  })
  @ApiCreatedResponse({ description: 'Collection created', type: CreateCollectionResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  @ApiValidationRequest()
  async createCollection(
    @CurrentUser() user: JwtPayload,
    @Body() payload: CreateCollectionDto,
  ): Promise<CreateCollectionResponseDto> {
    return this.bookmarkApplicationService.createCollection(user, payload);
  }

  @Get('collections/:collectionId')
  @ApiAuth()
  @ApiOperation({
    summary: 'List bookmarks in collection',
    description: 'Returns all bookmarked quizzes within a specific collection.',
  })
  @ApiOkResponse({ description: 'Bookmarks returned', type: BookmarkListResponseDto })
  @ApiNotFoundResponse({ description: 'Collection not found' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  async listBookmarksInCollection(
    @Param('collectionId', new ParseUUIDPipe()) collectionId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<BookmarkListResponseDto> {
    return this.bookmarkApplicationService.listBookmarksInCollection(collectionId, user);
  }

  @Post('collections/:collectionId/quizzes')
  @ApiAuth()
  @ApiOperation({ summary: 'Add bookmark', description: 'Adds a quiz to a bookmark collection.' })
  @ApiCreatedResponse({ description: 'Bookmark added', type: AddBookmarkResponseDto })
  @ApiNotFoundResponse({ description: 'Collection or quiz not found' })
  @ApiConflictResponse({ description: 'Quiz is already bookmarked in this collection' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  @ApiValidationRequest()
  async addBookmark(
    @Param('collectionId', new ParseUUIDPipe()) collectionId: string,
    @CurrentUser() user: JwtPayload,
    @Body() payload: AddBookmarkDto,
  ): Promise<AddBookmarkResponseDto> {
    return this.bookmarkApplicationService.addBookmark(collectionId, payload, user);
  }

  @Delete('collections/:collectionId/quizzes/:quizId')
  @ApiAuth()
  @ApiOperation({
    summary: 'Remove bookmark',
    description: 'Removes a quiz from a bookmark collection.',
  })
  @ApiOkResponse({ description: 'Bookmark removed', type: RemoveBookmarkResponseDto })
  @ApiNotFoundResponse({ description: 'Collection or bookmark not found' })
  @ApiForbiddenResponse({ description: 'Not the collection owner' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  async removeBookmark(
    @Param('collectionId', new ParseUUIDPipe()) collectionId: string,
    @Param('quizId', new ParseUUIDPipe()) quizId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<RemoveBookmarkResponseDto> {
    return this.bookmarkApplicationService.removeBookmark(collectionId, quizId, user);
  }

  @Patch('collections/:collectionId')
  @ApiAuth()
  @ApiOperation({
    summary: 'Update collection',
    description: 'Updates the name and/or description of a bookmark collection.',
  })
  @ApiOkResponse({ description: 'Collection updated', type: UpdateCollectionResponseDto })
  @ApiNotFoundResponse({ description: 'Collection not found' })
  @ApiForbiddenResponse({ description: 'Not the collection owner' })
  @ApiConflictResponse({ description: 'A collection with this name already exists' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  @ApiValidationRequest()
  async updateCollection(
    @Param('collectionId', new ParseUUIDPipe()) collectionId: string,
    @CurrentUser() user: JwtPayload,
    @Body() payload: UpdateCollectionDto,
  ): Promise<UpdateCollectionResponseDto> {
    return this.bookmarkApplicationService.updateCollection(collectionId, payload, user);
  }

  @Delete('collections/:collectionId')
  @ApiAuth()
  @ApiOperation({
    summary: 'Delete collection',
    description: 'Deletes a bookmark collection and all its bookmarked quizzes.',
  })
  @ApiOkResponse({ description: 'Collection deleted', type: DeleteCollectionResponseDto })
  @ApiNotFoundResponse({ description: 'Collection not found' })
  @ApiForbiddenResponse({ description: 'Not the collection owner' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  async deleteCollection(
    @Param('collectionId', new ParseUUIDPipe()) collectionId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<DeleteCollectionResponseDto> {
    return this.bookmarkApplicationService.deleteCollection(collectionId, user);
  }
}
