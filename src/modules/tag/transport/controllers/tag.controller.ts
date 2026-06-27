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
import { TagDomainExceptionFilter } from '../filters/tag-domain-exception.filter';
import { TagCursorMapper } from '../../mappers/tag-cursor.mapper';
import type { ListQuizzesQueryDto } from '@/modules/quiz/dto/request/list-quizzes-query.dto';
import type {
  CreateTagCommand,
  ListTagsQuery,
  UpdateTagCommand,
} from '../../domain/types/tag-commands';
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
  ApiTagQuizzesResponse,
  ApiTrendingTagsResponse,
  ApiUnfollowTagResponse,
  ApiUpdateTagResponse,
} from '../swagger/tag-swagger-decorators';

@ApiTags('tags')
@Controller('tags')
@UseFilters(TagDomainExceptionFilter)
export class TagController {
  constructor(private readonly tagApplicationService: TagApplicationService) {}

  @Get('popular')
  @Public()
  @ApiPopularTagsResponse()
  getPopularTags(@Query() query: TagRankingQueryDto) {
    return this.tagApplicationService.getPopularTags({ limit: query.limit });
  }

  @Get('trending')
  @Public()
  @ApiTrendingTagsResponse()
  getTrendingTags(@Query() query: TagRankingQueryDto) {
    return this.tagApplicationService.getTrendingTags({ limit: query.limit });
  }

  @Get(':slug/quizzes')
  @Public()
  @ApiTagQuizzesResponse()
  getTagQuizzes(@Param('slug') slug: string, @Query() query: ListQuizzesQueryDto) {
    return this.tagApplicationService.getTagQuizzesBySlug(slug, query);
  }

  @Get(':slug/related')
  @Public()
  @ApiRelatedTagsResponse()
  getRelatedTags(@Param('slug') slug: string, @Query() query: RelatedTagsQueryDto) {
    return this.tagApplicationService.getRelatedTags(slug, { limit: query.limit ?? 10 });
  }

  @Get(':id/analytics')
  @Public()
  @ApiTagAnalyticsResponse()
  getTagAnalytics(@Param('id', new ParseUUIDPipe()) tagId: string) {
    return this.tagApplicationService.getTagAnalytics(tagId);
  }

  @Post(':id/follow')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiFollowTagResponse()
  followTag(@Param('id', new ParseUUIDPipe()) tagId: string, @CurrentUser() user: JwtPayload) {
    return this.tagApplicationService.followTag(user.sub, tagId);
  }

  @Delete(':id/follow')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiUnfollowTagResponse()
  unfollowTag(@Param('id', new ParseUUIDPipe()) tagId: string, @CurrentUser() user: JwtPayload) {
    return this.tagApplicationService.unfollowTag(user.sub, tagId);
  }

  @Post(':id/restore')
  @Permissions(Permission.TAG_MANAGE)
  @ApiRestoreTagResponse()
  restoreTag(@Param('id', new ParseUUIDPipe()) tagId: string) {
    return this.tagApplicationService.restoreTag(tagId);
  }

  @Get()
  @Public()
  @ApiListTagsResponse()
  listTags(@Query() query: ListTagsQueryDto) {
    const command: ListTagsQuery = {
      limit: query.limit,
      cursor: query.cursor ? TagCursorMapper.parse(query.cursor) : null,
    };
    return this.tagApplicationService.listTags(command);
  }

  @Get(':slug')
  @Public()
  @ApiTagBySlugResponse()
  getTagBySlug(@Param('slug') slug: string) {
    return this.tagApplicationService.getTagBySlug(slug);
  }

  @Post()
  @Permissions(Permission.TAG_MANAGE)
  @ApiCreateTagResponse()
  createTag(@Body() payload: CreateTagDto) {
    const command: CreateTagCommand = { name: payload.name, slug: payload.slug };
    return this.tagApplicationService.createTag(command);
  }

  @Patch(':id')
  @Permissions(Permission.TAG_MANAGE)
  @ApiUpdateTagResponse()
  updateTag(@Param('id', new ParseUUIDPipe()) tagId: string, @Body() payload: UpdateTagDto) {
    const command: UpdateTagCommand = { name: payload.name, slug: payload.slug };
    return this.tagApplicationService.updateTag(tagId, command);
  }

  @Delete(':id')
  @Permissions(Permission.TAG_MANAGE)
  @ApiDeleteTagResponse()
  deleteTag(@Param('id', new ParseUUIDPipe()) tagId: string) {
    return this.tagApplicationService.deleteTag(tagId);
  }
}
