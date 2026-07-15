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
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
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
  @ApiPopularTagsResponse()
  async getPopularTags(@Query() query: TagRankingQueryDto) {
    const items = await this.tagApplicationService.getPopularTags({ limit: query.limit });
    return this.presenter.getPopularTags(items);
  }

  @Get('trending')
  @Public()
  @ApiTrendingTagsResponse()
  async getTrendingTags(@Query() query: TagRankingQueryDto) {
    const items = await this.tagApplicationService.getTrendingTags({ limit: query.limit });
    return this.presenter.getTrendingTags(items);
  }

  @Get(':slug/quizzes')
  @Public()
  @ApiTagQuizzesResponse()
  async getTagQuizzes(@Param('slug') slug: string, @Query() query: ListQuizzesQueryDto) {
    const result = await this.tagApplicationService.getTagQuizzesBySlug(slug, query);
    return this.presenter.getTagQuizzes(result);
  }

  @Get(':slug/related')
  @Public()
  @ApiRelatedTagsResponse()
  async getRelatedTags(@Param('slug') slug: string, @Query() query: RelatedTagsQueryDto) {
    const items = await this.tagApplicationService.getRelatedTags(slug, {
      limit: query.limit ?? 10,
    });
    return this.presenter.getRelatedTags(items);
  }

  @Get(':id/analytics')
  @Public()
  @ApiTagAnalyticsResponse()
  @ApiTagIdParam()
  async getTagAnalytics(@Param('id', new ParseUUIDPipe()) tagId: string) {
    const result = await this.tagApplicationService.getTagAnalytics(tagId);
    return this.presenter.getTagAnalytics(result);
  }

  @Post(':id/follow')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiFollowTagResponse()
  @ApiTagIdParam()
  async followTag(
    @Param('id', new ParseUUIDPipe()) tagId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.tagApplicationService.followTag(user.sub, tagId);
    return this.presenter.followTag(result);
  }

  @Delete(':id/follow')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiUnfollowTagResponse()
  @ApiTagIdParam()
  async unfollowTag(
    @Param('id', new ParseUUIDPipe()) tagId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.tagApplicationService.unfollowTag(user.sub, tagId);
    return this.presenter.unfollowTag(result);
  }

  @Post(':id/restore')
  @Permissions(Permission.TAG_MANAGE)
  @ApiRestoreTagResponse()
  @ApiTagIdParam()
  async restoreTag(@Param('id', new ParseUUIDPipe()) tagId: string) {
    const result = await this.tagApplicationService.restoreTag(tagId);
    return this.presenter.restoreTag(result);
  }

  @Get()
  @Public()
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
  @ApiTagBySlugResponse()
  async getTagBySlug(@Param('slug') slug: string) {
    const result = await this.tagApplicationService.getTagBySlug(slug);
    return this.presenter.getTagBySlug(result);
  }

  @Post()
  @Permissions(Permission.TAG_MANAGE)
  @ApiCreateTagResponse()
  async createTag(@Body() payload: CreateTagDto) {
    const command: CreateTagCommand = { name: payload.name, slug: payload.slug };
    const result = await this.tagApplicationService.createTag(command);
    return this.presenter.createTag(result);
  }

  @Patch(':id')
  @Permissions(Permission.TAG_MANAGE)
  @ApiUpdateTagResponse()
  @ApiTagIdParam()
  async updateTag(@Param('id', new ParseUUIDPipe()) tagId: string, @Body() payload: UpdateTagDto) {
    const command: UpdateTagCommand = { name: payload.name, slug: payload.slug };
    const result = await this.tagApplicationService.updateTag(tagId, command);
    return this.presenter.updateTag(result);
  }

  @Delete(':id')
  @Permissions(Permission.TAG_MANAGE)
  @ApiDeleteTagResponse()
  @ApiTagIdParam()
  async deleteTag(@Param('id', new ParseUUIDPipe()) tagId: string) {
    const result = await this.tagApplicationService.deleteTag(tagId);
    return this.presenter.deleteTag(result);
  }
}
