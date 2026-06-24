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
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiOkResponse, ApiNotFoundResponse } from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import { Permissions } from '@/common/authorization/decorators/permissions.decorator';
import { Permission } from '@/common/authorization/permissions';
import {
  ApiAuth,
  ApiAuthCreate,
  ApiAuthUpdate,
  ApiPublicList,
  ApiConflict,
  ApiInternalError,
  ApiAuthDelete,
} from '@/common/swagger/swagger-decorators';
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
  UpdateTagCommand,
} from '../../domain/types/tag-commands';
import type { ListQuizzesQueryDto } from '@/modules/quiz/dto/request/list-quizzes-query.dto';
import { TagListResponseDto, TagResponseDto, TagQuizzesResponseDto } from '../../dto/response';

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
  @ApiInternalError()
  getPopularTags(@Query() query: TagRankingQueryDto): Promise<RankedTagsResponseDto> {
    return this.tagApplicationService.getPopularTags({ limit: query.limit });
  }

  @Get('trending')
  @Public()
  @ApiOperation({
    summary: 'Trending tags',
    description: 'Returns tags ranked by aggregated quiz trending score.',
  })
  @ApiOkResponse({ description: 'Ranked tags returned', type: RankedTagsResponseDto })
  @ApiInternalError()
  getTrendingTags(@Query() query: TagRankingQueryDto): Promise<RankedTagsResponseDto> {
    return this.tagApplicationService.getTrendingTags({ limit: query.limit });
  }

  // ─── Wildcard public routes ───────────────────────────────────────────────────

  @Get(':slug/quizzes')
  @Public()
  @ApiPublicList({ description: 'Quizzes returned', type: TagQuizzesResponseDto })
  async getTagQuizzes(
    @Param('slug') slug: string,
    @Query() query: ListQuizzesQueryDto,
  ): Promise<TagQuizzesResponseDto> {
    return this.tagApplicationService.getTagQuizzesBySlug(slug, query);
  }

  @Get(':slug/related')
  @Public()
  @ApiPublicList({ description: 'Related tags returned', type: RelatedTagsResponseDto })
  getRelatedTags(
    @Param('slug') slug: string,
    @Query() query: RelatedTagsQueryDto,
  ): Promise<RelatedTagsResponseDto> {
    const relatedTagsQuery = { limit: query.limit ?? 10 };
    return this.tagApplicationService.getRelatedTags(slug, relatedTagsQuery);
  }

  @Get(':id/analytics')
  @Public()
  @ApiPublicList({ description: 'Analytics returned', type: TagAnalyticsResponseDto })
  getTagAnalytics(
    @Param('id', new ParseUUIDPipe()) tagId: string,
  ): Promise<TagAnalyticsResponseDto> {
    return this.tagApplicationService.getTagAnalytics(tagId);
  }

  // ─── Authenticated follow endpoints ──────────────────────────────────────────

  @Post(':id/follow')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiAuth()
  @ApiOperation({
    summary: 'Follow a tag',
    description: 'Adds the authenticated user to the tag followers. Idempotent.',
  })
  @ApiOkResponse({ description: 'Tag followed', type: TagFollowMessageResponseDto })
  @ApiNotFoundResponse()
  @ApiInternalError()
  followTag(
    @Param('id', new ParseUUIDPipe()) tagId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<TagFollowMessageResponseDto> {
    return this.tagApplicationService.followTag(user.sub, tagId);
  }

  @Delete(':id/follow')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiAuth()
  @ApiOperation({
    summary: 'Unfollow a tag',
    description: 'Removes the authenticated user from the tag followers. Idempotent.',
  })
  @ApiOkResponse({ description: 'Tag unfollowed', type: TagFollowMessageResponseDto })
  @ApiInternalError()
  unfollowTag(
    @Param('id', new ParseUUIDPipe()) tagId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<TagFollowMessageResponseDto> {
    return this.tagApplicationService.unfollowTag(user.sub, tagId);
  }

  // ─── Admin restore endpoint ───────────────────────────────────────────────────

  @Post(':id/restore')
  @Permissions(Permission.TAG_MANAGE)
  @ApiAuth()
  @ApiOperation({
    summary: 'Restore tag',
    description: 'Restores a soft-deleted tag. Requires admin role.',
  })
  @ApiOkResponse({ description: 'Tag restored', type: TagResponseDto })
  @ApiNotFoundResponse()
  @ApiConflict()
  @ApiInternalError()
  restoreTag(@Param('id', new ParseUUIDPipe()) tagId: string): Promise<TagResponseDto> {
    return this.tagApplicationService.restoreTag(tagId);
  }

  // ─── Core list and CRUD ───────────────────────────────────────────────────────

  @Get()
  @Public()
  @ApiPublicList({ description: 'Tags returned', type: TagListResponseDto })
  listTags(@Query() query: ListTagsQueryDto): Promise<TagListResponseDto> {
    const command: ListTagsQuery = {
      limit: query.limit,
      cursor: query.cursor ? TagCursorMapper.parse(query.cursor) : null,
    };
    return this.tagApplicationService.listTags(command);
  }

  @Get(':slug')
  @Public()
  @ApiPublicList({ description: 'Tag found', type: TagResponseDto })
  getTagBySlug(@Param('slug') slug: string): Promise<TagResponseDto> {
    return this.tagApplicationService.getTagBySlug(slug);
  }

  @Post()
  @Permissions(Permission.TAG_MANAGE)
  @ApiAuthCreate({ description: 'Tag created', type: TagResponseDto })
  createTag(@Body() payload: CreateTagDto): Promise<TagResponseDto> {
    const command: CreateTagCommand = { name: payload.name, slug: payload.slug };
    return this.tagApplicationService.createTag(command);
  }

  @Patch(':id')
  @Permissions(Permission.TAG_MANAGE)
  @ApiAuthUpdate({ description: 'Tag updated', type: TagResponseDto })
  updateTag(
    @Param('id', new ParseUUIDPipe()) tagId: string,
    @Body() payload: UpdateTagDto,
  ): Promise<TagResponseDto> {
    const command: UpdateTagCommand = { name: payload.name, slug: payload.slug };
    return this.tagApplicationService.updateTag(tagId, command);
  }

  @Delete(':id')
  @Permissions(Permission.TAG_MANAGE)
  @ApiAuthDelete('Tag deleted')
  deleteTag(@Param('id', new ParseUUIDPipe()) tagId: string): Promise<DeleteTagResponseDto> {
    return this.tagApplicationService.deleteTag(tagId);
  }
}
