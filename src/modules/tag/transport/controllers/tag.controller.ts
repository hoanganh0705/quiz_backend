import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Transactional } from '@/common/interceptors/transactional.interceptor';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import { Permissions } from '@/common/authorization/decorators/permissions.decorator';
import { Permission } from '@/common/authorization/permissions';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { CreateTagDto } from '../../dto/request/create-tag.dto';
import { ListTagsQueryDto } from '../../dto/request/list-tags-query.dto';
import { UpdateTagDto } from '../../dto/request/update-tag.dto';
import { TagRankingQueryDto } from '../../dto/request/tag-ranking-query.dto';
import { RelatedTagsQueryDto } from '../../dto/request/related-tags-query.dto';
import { TagSlugsQueryDto } from '../../dto/request/tag-slugs-query.dto';
import { TagApplicationService } from '../../application/tag.application.service';
import { TagCursorMapper } from '../../mappers/tag-cursor.mapper';
import type { ListQuizzesQueryDto } from '@/modules/quiz/dto/request/list-quizzes-query.dto';
import type {
  CreateTagCommand,
  ListTagsQuery,
  UpdateTagCommand,
} from '../../domain/types/tag-commands';
import { TagPresenter } from '../presenters/tag.presenter';
import {
  ApiCreateTagResponse,
  ApiDeleteTagResponse,
  ApiFollowTagResponse,
  ApiListTagsResponse,
  ApiPopularTagsResponse,
  ApiRelatedTagsResponse,
  ApiRestoreTagResponse,
  ApiTagAnalyticsResponse,
  ApiTagByIdResponse,
  ApiTagBySlugsResponse,
  ApiTagBySlugResponse,
  ApiTagIdParam,
  ApiTagQuizzesResponse,
  ApiTrendingTagsResponse,
  ApiUnfollowTagResponse,
  ApiUpdateTagResponse,
} from '../swagger/tag-swagger-decorators';

@ApiTags('tags')
@Controller('tags')
export class TagController {
  constructor(
    private readonly tagApplicationService: TagApplicationService,
    private readonly presenter: TagPresenter,
  ) {}

  @Get('popular')
  @Public()
  @ApiOperation({ summary: 'List popular tags' })
  @ApiPopularTagsResponse()
  async getPopularTags(@Query() query: TagRankingQueryDto) {
    const items = await this.tagApplicationService.getPopularTags({ limit: query.limit ?? 10 });
    return this.presenter.getPopularTags(items);
  }

  @Get('trending')
  @Public()
  @ApiOperation({ summary: 'List trending tags' })
  @ApiTrendingTagsResponse()
  async getTrendingTags(@Query() query: TagRankingQueryDto) {
    const items = await this.tagApplicationService.getTrendingTags({ limit: query.limit ?? 10 });
    return this.presenter.getTrendingTags(items);
  }

  /**
   * Phase 2 (S-13): batched lookup by slug list.
   * The frontend's `useTagSlugsResolver` hook calls this to map a
   * list of user-supplied slugs (e.g. from URL state) into
   * full tag records.
   *
   * Missing slugs are silently omitted from the response so the
   * client can render "unknown tag" chips without a 404.
   */
  @Get('by-slugs')
  @Public()
  @ApiOperation({ summary: 'Resolve a list of tag slugs into tag records' })
  @ApiTagBySlugsResponse()
  async getTagsBySlugs(@Query() query: TagSlugsQueryDto) {
    const items = await this.tagApplicationService.getTagsBySlugs(query.slugs ?? []);
    return this.presenter.getTagsBySlugs(items);
  }

  @Get(':slug/quizzes')
  @Public()
  @ApiOperation({ summary: 'List quizzes in a tag' })
  @ApiTagQuizzesResponse()
  @ApiQuery({
    name: 'cursor',
    required: false,
    description: 'Opaque pagination cursor returned by the previous page',
    schema: { type: 'string' },
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Page size (1–100). Defaults to 20.',
    schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
  })
  async getTagQuizzes(@Param('slug') slug: string, @Query() query: ListQuizzesQueryDto) {
    const result = await this.tagApplicationService.getTagQuizzesBySlug(slug, query);
    return this.presenter.getTagQuizzes(result);
  }

  @Get(':slug/related')
  @Public()
  @ApiOperation({ summary: 'List tags related to a tag' })
  @ApiRelatedTagsResponse()
  async getRelatedTags(@Param('slug') slug: string, @Query() query: RelatedTagsQueryDto) {
    const items = await this.tagApplicationService.getRelatedTags(slug, {
      limit: query.limit ?? 10,
    });
    return this.presenter.getRelatedTags(items);
  }

  @Get(':id/analytics')
  @Public()
  @ApiOperation({ summary: 'Get analytics for a tag' })
  @ApiTagAnalyticsResponse()
  @ApiTagIdParam()
  async getTagAnalytics(@Param('id', new ParseUUIDPipe({ version: '7' })) tagId: string) {
    const result = await this.tagApplicationService.getTagAnalytics(tagId);
    return this.presenter.getTagAnalytics(result);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get a tag by ID' })
  @ApiTagByIdResponse()
  @ApiTagIdParam()
  async getTagById(@Param('id', new ParseUUIDPipe({ version: '7' })) tagId: string) {
    const result = await this.tagApplicationService.getTagById(tagId);
    return this.presenter.getTagById(result);
  }

  @Post(':id/follow')
  @Transactional()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Follow a tag' })
  @ApiFollowTagResponse()
  @ApiTagIdParam()
  async followTag(
    @Param('id', new ParseUUIDPipe({ version: '7' })) tagId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    await this.tagApplicationService.followTag(user.sub, tagId);
  }

  @Delete(':id/follow')
  @Transactional()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unfollow a tag' })
  @ApiUnfollowTagResponse()
  @ApiTagIdParam()
  async unfollowTag(
    @Param('id', new ParseUUIDPipe({ version: '7' })) tagId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    await this.tagApplicationService.unfollowTag(user.sub, tagId);
  }

  @Post(':id/restore')
  @Permissions(Permission.TAG_MANAGE)
  @ApiOperation({ summary: 'Restore a deleted tag' })
  @ApiRestoreTagResponse()
  @ApiTagIdParam()
  async restoreTag(@Param('id', new ParseUUIDPipe({ version: '7' })) tagId: string) {
    const result = await this.tagApplicationService.restoreTag(tagId);
    return this.presenter.restoreTag(result);
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'List all tags' })
  @ApiListTagsResponse()
  async listTags(@Query() query: ListTagsQueryDto) {
    const command: ListTagsQuery = {
      limit: query.limit,
      cursor: query.cursor ? TagCursorMapper.parse(query.cursor) : null,
    };
    const result = await this.tagApplicationService.listTags(command);
    return this.presenter.listTags(result);
  }

  @Get(':slug')
  @Public()
  @ApiOperation({ summary: 'Get a tag by slug' })
  @ApiTagBySlugResponse()
  async getTagBySlug(@Param('slug') slug: string) {
    const result = await this.tagApplicationService.getTagBySlug(slug);
    return this.presenter.getTagBySlug(result);
  }

  @Post()
  @Permissions(Permission.TAG_MANAGE)
  @ApiOperation({ summary: 'Create a tag' })
  @ApiCreateTagResponse()
  async createTag(@Body() payload: CreateTagDto) {
    const command: CreateTagCommand = { name: payload.name, slug: payload.slug };
    const result = await this.tagApplicationService.createTag(command);
    return this.presenter.createTag(result);
  }

  @Patch(':id')
  @Permissions(Permission.TAG_MANAGE)
  @ApiOperation({ summary: 'Update a tag' })
  @ApiUpdateTagResponse()
  @ApiTagIdParam()
  async updateTag(
    @Param('id', new ParseUUIDPipe({ version: '7' })) tagId: string,
    @Body() payload: UpdateTagDto,
  ) {
    const command: UpdateTagCommand = { name: payload.name, slug: payload.slug };
    const result = await this.tagApplicationService.updateTag(tagId, command);
    return this.presenter.updateTag(result);
  }

  @Delete(':id')
  @Permissions(Permission.TAG_MANAGE)
  @ApiOperation({ summary: 'Delete a tag' })
  @ApiDeleteTagResponse()
  @ApiTagIdParam()
  async deleteTag(@Param('id', new ParseUUIDPipe({ version: '7' })) tagId: string) {
    const result = await this.tagApplicationService.deleteTag(tagId);
    return this.presenter.deleteTag(result);
  }
}
