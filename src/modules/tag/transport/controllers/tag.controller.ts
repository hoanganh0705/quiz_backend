import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseFilters,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiInternalServerErrorResponse,
} from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import { Roles } from '@/common/authorization/decorators/roles.decorator';
import { ApiAuth, ApiValidationRequest } from '@/common/swagger/swagger-decorators';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { CreateTagDto } from '../../dto/request/create-tag.dto';
import { ListTagsQueryDto } from '../../dto/request/list-tags-query.dto';
import { UpdateTagDto } from '../../dto/request/update-tag.dto';
import { TagRankingQueryDto } from '../../dto/request/tag-ranking-query.dto';
import { RelatedTagsQueryDto } from '../../dto/request/related-tags-query.dto';
import { DeleteTagResponseDto } from '../../dto/response/delete-tag-response.dto';
import {
  RankedTagsResponseDto,
  RelatedTagsResponseDto,
  TagFollowMessageResponseDto,
  TagAnalyticsResponseDto,
} from '../../dto/response/parity-response.dto';
import { TagApplicationService } from '../../application/tag.application.service';
import { TagDomainExceptionFilter } from '../filters/tag-domain-exception.filter';
import { TagCursorMapper } from '../../mappers/tag-cursor.mapper';
import type {
  CreateTagCommand,
  ListTagsQuery,
  RelatedTagsQuery,
  UpdateTagCommand,
} from '../../domain/types/tag-commands';
import type { ListQuizzesQueryDto } from '@/modules/quiz/dto/request/list-quizzes-query.dto';
import type { QuizListResponseDto } from '@/modules/quiz/dto/response/quiz-list-response.dto';
import { TagListResponseDto, TagResponseDto } from '../../dto/response';

@ApiTags('tags')
@Controller('tags')
@UseFilters(TagDomainExceptionFilter)
export class TagController {
  constructor(private readonly tagApplicationService: TagApplicationService) {}

  // ─── Static public routes (must come before :slug wildcard) ───────────────────

  @Get('popular')
  @Public()
  @ApiOperation({
    summary: 'Popular tags',
    description: 'Returns tags ranked by aggregated quiz popularity score.',
  })
  @ApiOkResponse({ description: 'Ranked tags returned', type: RankedTagsResponseDto })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  getPopularTags(@Query() query: TagRankingQueryDto): Promise<RankedTagsResponseDto> {
    return this.tagApplicationService.getPopularTags({ limit: query.limit ?? 10 });
  }

  @Get('trending')
  @Public()
  @ApiOperation({
    summary: 'Trending tags',
    description: 'Returns tags ranked by aggregated quiz trending score.',
  })
  @ApiOkResponse({ description: 'Ranked tags returned', type: RankedTagsResponseDto })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  getTrendingTags(@Query() query: TagRankingQueryDto): Promise<RankedTagsResponseDto> {
    return this.tagApplicationService.getTrendingTags({ limit: query.limit ?? 10 });
  }

  // ─── Wildcard public routes ───────────────────────────────────────────────────

  @Get(':slug/quizzes')
  @Public()
  @ApiOperation({
    summary: 'List quizzes with a tag',
    description:
      'Returns the same quiz list response as GET /quizzes, filtered to the given tag slug.',
  })
  @ApiOkResponse({ description: 'Quizzes returned' })
  @ApiNotFoundResponse({ description: 'Tag not found' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  async getTagQuizzes(
    @Param('slug') slug: string,
    @Query() query: ListQuizzesQueryDto,
  ): Promise<QuizListResponseDto> {
    return this.tagApplicationService.getTagQuizzesBySlug(slug, query);
  }

  @Get(':slug/related')
  @Public()
  @ApiOperation({
    summary: 'Related tags',
    description: 'Returns active tags related to the given tag slug.',
  })
  @ApiOkResponse({ description: 'Related tags returned', type: RelatedTagsResponseDto })
  @ApiNotFoundResponse({ description: 'Tag not found' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  getRelatedTags(
    @Param('slug') slug: string,
    @Query() query: RelatedTagsQueryDto,
  ): Promise<RelatedTagsResponseDto> {
    const relatedTagsQuery = { limit: query.limit ?? 10 };
    return this.tagApplicationService.getRelatedTags(slug, relatedTagsQuery);
  }

  @Get(':id/analytics')
  @Public()
  @ApiOperation({
    summary: 'Tag analytics',
    description:
      'Returns aggregated analytics for all quizzes with this tag. ' +
      'NOTE: This endpoint is not yet implemented and returns 404.',
  })
  @ApiOkResponse({ description: 'Analytics returned', type: TagAnalyticsResponseDto })
  @ApiNotFoundResponse({ description: 'Tag or analytics not found' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  getTagAnalytics(
    @Param('id', new ParseUUIDPipe()) tagId: string,
  ): Promise<TagAnalyticsResponseDto> {
    return this.tagApplicationService.getTagAnalytics(tagId);
  }

  // ─── Authenticated follow endpoints ──────────────────────────────────────────

  @Post(':id/follow')
  @ApiBearerAuth()
  @ApiAuth()
  @ApiOperation({
    summary: 'Follow a tag',
    description: 'Adds the authenticated user to the tag followers. Idempotent.',
  })
  @ApiOkResponse({ description: 'Tag followed', type: TagFollowMessageResponseDto })
  @ApiNotFoundResponse({ description: 'Tag not found' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  followTag(
    @Param('id', new ParseUUIDPipe()) tagId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<TagFollowMessageResponseDto> {
    return this.tagApplicationService.followTag(user.sub, tagId);
  }

  @Delete(':id/follow')
  @ApiBearerAuth()
  @ApiAuth()
  @ApiOperation({
    summary: 'Unfollow a tag',
    description: 'Removes the authenticated user from the tag followers. Idempotent.',
  })
  @ApiOkResponse({ description: 'Tag unfollowed', type: TagFollowMessageResponseDto })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  unfollowTag(
    @Param('id', new ParseUUIDPipe()) tagId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<TagFollowMessageResponseDto> {
    return this.tagApplicationService.unfollowTag(user.sub, tagId);
  }

  // ─── Admin restore endpoint ───────────────────────────────────────────────────

  @Post(':id/restore')
  @Roles('admin')
  @ApiBearerAuth()
  @ApiAuth()
  @ApiOperation({
    summary: 'Restore tag',
    description: 'Restores a soft-deleted tag. Requires admin role.',
  })
  @ApiOkResponse({ description: 'Tag restored', type: TagResponseDto })
  @ApiNotFoundResponse({ description: 'Tag not found' })
  @ApiConflictResponse({ description: 'Tag already active or slug conflict' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  restoreTag(@Param('id', new ParseUUIDPipe()) tagId: string): Promise<TagResponseDto> {
    return this.tagApplicationService.restoreTag(tagId);
  }

  // ─── Core list and CRUD ───────────────────────────────────────────────────────

  @Get()
  @Public()
  @ApiOperation({
    summary: 'List tags',
    description: 'Returns a paginated, cursor-based list of active tags.',
  })
  @ApiOkResponse({ description: 'Tags returned', type: TagListResponseDto })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  listTags(@Query() query: ListTagsQueryDto): Promise<TagListResponseDto> {
    const command: ListTagsQuery = {
      limit: query.limit,
      cursor: query.cursor ? TagCursorMapper.parse(query.cursor) : null,
    };
    return this.tagApplicationService.listTags(command);
  }

  @Get(':slug')
  @Public()
  @ApiOperation({
    summary: 'Get tag by slug',
    description: 'Returns a single active tag by its URL slug.',
  })
  @ApiOkResponse({ description: 'Tag found', type: TagResponseDto })
  @ApiNotFoundResponse({ description: 'Tag not found' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  getTagBySlug(@Param('slug') slug: string): Promise<TagResponseDto> {
    return this.tagApplicationService.getTagBySlug(slug);
  }

  @Post()
  @Roles('admin')
  @ApiBearerAuth()
  @ApiAuth()
  @ApiOperation({
    summary: 'Create tag',
    description: 'Creates a new quiz tag. Requires admin role.',
  })
  @ApiCreatedResponse({ description: 'Tag created', type: TagResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiConflictResponse({ description: 'A tag with this slug already exists' })
  @ApiNotFoundResponse({ description: 'Tag not found' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  @ApiValidationRequest()
  createTag(@Body() payload: CreateTagDto): Promise<TagResponseDto> {
    const command: CreateTagCommand = { name: payload.name, slug: payload.slug };
    return this.tagApplicationService.createTag(command);
  }

  @Patch(':id')
  @Roles('admin')
  @ApiBearerAuth()
  @ApiAuth()
  @ApiOperation({
    summary: 'Update tag',
    description: 'Updates an existing tag by ID. Requires admin role.',
  })
  @ApiOkResponse({ description: 'Tag updated', type: TagResponseDto })
  @ApiNotFoundResponse({ description: 'Tag not found' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiConflictResponse({ description: 'A tag with this slug already exists' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  @ApiValidationRequest()
  updateTag(
    @Param('id', new ParseUUIDPipe()) tagId: string,
    @Body() payload: UpdateTagDto,
  ): Promise<TagResponseDto> {
    const command: UpdateTagCommand = { name: payload.name, slug: payload.slug };
    return this.tagApplicationService.updateTag(tagId, command);
  }

  @Delete(':id')
  @Roles('admin')
  @ApiBearerAuth()
  @ApiAuth()
  @ApiOperation({ summary: 'Delete tag', description: 'Soft-deletes a tag. Requires admin role.' })
  @ApiOkResponse({ description: 'Tag deleted', type: DeleteTagResponseDto })
  @ApiNotFoundResponse({ description: 'Tag not found' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  deleteTag(@Param('id', new ParseUUIDPipe()) tagId: string): Promise<DeleteTagResponseDto> {
    return this.tagApplicationService.deleteTag(tagId);
  }
}
