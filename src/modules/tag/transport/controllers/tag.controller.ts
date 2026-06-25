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
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
  ApiInternalServerErrorResponse,
} from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import { Permissions } from '@/common/authorization/decorators/permissions.decorator';
import { Permission } from '@/common/authorization/permissions';
import {
  ApiAuth,
  ApiAuthCreate,
  ApiAuthUpdate,
  ApiPublicList,
} from '@/common/swagger/swagger-decorators';
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
import {
  TagWrappedRankedListDto,
  TagWrappedRelatedListDto,
  TagWrappedAnalyticsDto,
  TagWrappedFollowMessageDto,
  TagWrappedDeleteMessageDto,
  TagWrappedTagDto,
  TagWrappedListDto,
} from '../../dto/response/tag-response-docs.dto';
import { WrappedQuizListDto } from '@/modules/quiz/dto/response/quiz-response-docs.dto';
import type {
  CreateTagCommand,
  ListTagsQuery,
  UpdateTagCommand,
} from '../../domain/types/tag-commands';
import type { ListQuizzesQueryDto } from '@/modules/quiz/dto/request/list-quizzes-query.dto';

@ApiTags('tags')
@Controller('tags')
@UseFilters(TagDomainExceptionFilter)
export class TagController {
  constructor(private readonly tagApplicationService: TagApplicationService) {}

  @Get('popular')
  @Public()
  @ApiOperation({
    summary: 'Popular tags',
    description: 'Returns tags ranked by aggregated quiz popularity score.',
  })
  @ApiOkResponse({
    description: 'Ranked tags returned',
    type: TagWrappedRankedListDto,
  })
  @ApiInternalServerErrorResponse()
  getPopularTags(@Query() query: TagRankingQueryDto) {
    return this.tagApplicationService.getPopularTags({ limit: query.limit });
  }

  @Get('trending')
  @Public()
  @ApiOperation({
    summary: 'Trending tags',
    description: 'Returns tags ranked by aggregated quiz trending score.',
  })
  @ApiOkResponse({
    description: 'Ranked tags returned',
    type: TagWrappedRankedListDto,
  })
  @ApiInternalServerErrorResponse()
  getTrendingTags(@Query() query: TagRankingQueryDto) {
    return this.tagApplicationService.getTrendingTags({ limit: query.limit });
  }

  @Get(':slug/quizzes')
  @Public()
  @ApiPublicList({ description: 'Quizzes in tag returned', type: WrappedQuizListDto })
  @ApiNotFoundResponse({ description: 'Tag not found' })
  @ApiInternalServerErrorResponse()
  getTagQuizzes(@Param('slug') slug: string, @Query() query: ListQuizzesQueryDto) {
    return this.tagApplicationService.getTagQuizzesBySlug(slug, query);
  }

  @Get(':slug/related')
  @Public()
  @ApiPublicList({ description: 'Related tags returned', type: TagWrappedRelatedListDto })
  @ApiNotFoundResponse({ description: 'Tag not found' })
  @ApiInternalServerErrorResponse()
  getRelatedTags(@Param('slug') slug: string, @Query() query: RelatedTagsQueryDto) {
    return this.tagApplicationService.getRelatedTags(slug, { limit: query.limit ?? 10 });
  }

  @Get(':id/analytics')
  @Public()
  @ApiPublicList({ description: 'Analytics returned', type: TagWrappedAnalyticsDto })
  @ApiNotFoundResponse({ description: 'Tag analytics not found' })
  @ApiInternalServerErrorResponse()
  getTagAnalytics(@Param('id', new ParseUUIDPipe()) tagId: string) {
    return this.tagApplicationService.getTagAnalytics(tagId);
  }

  @Post(':id/follow')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiAuth()
  @ApiOperation({
    summary: 'Follow a tag',
    description: 'Adds the authenticated user to the tag followers. Idempotent.',
  })
  @ApiOkResponse({ description: 'Tag followed', type: TagWrappedFollowMessageDto })
  @ApiNotFoundResponse({ description: 'Tag not found' })
  @ApiInternalServerErrorResponse()
  followTag(@Param('id', new ParseUUIDPipe()) tagId: string, @CurrentUser() user: JwtPayload) {
    return this.tagApplicationService.followTag(user.sub, tagId);
  }

  @Delete(':id/follow')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiAuth()
  @ApiOperation({
    summary: 'Unfollow a tag',
    description: 'Removes the authenticated user from the tag followers. Idempotent.',
  })
  @ApiOkResponse({ description: 'Tag unfollowed', type: TagWrappedFollowMessageDto })
  @ApiNotFoundResponse({ description: 'Tag not found' })
  @ApiInternalServerErrorResponse()
  unfollowTag(@Param('id', new ParseUUIDPipe()) tagId: string, @CurrentUser() user: JwtPayload) {
    return this.tagApplicationService.unfollowTag(user.sub, tagId);
  }

  @Post(':id/restore')
  @Permissions(Permission.TAG_MANAGE)
  @ApiAuth()
  @ApiOperation({
    summary: 'Restore tag',
    description: 'Restores a soft-deleted tag. Requires admin role.',
  })
  @ApiOkResponse({ description: 'Tag restored', type: TagWrappedTagDto })
  @ApiNotFoundResponse({ description: 'Tag not found' })
  @ApiConflictResponse({
    description: 'A tag with this slug already exists or tag is already active',
  })
  @ApiInternalServerErrorResponse()
  restoreTag(@Param('id', new ParseUUIDPipe()) tagId: string) {
    return this.tagApplicationService.restoreTag(tagId);
  }

  @Get()
  @Public()
  @ApiPublicList({ description: 'Tags returned', type: TagWrappedListDto })
  @ApiInternalServerErrorResponse()
  listTags(@Query() query: ListTagsQueryDto) {
    const command: ListTagsQuery = {
      limit: query.limit,
      cursor: query.cursor ? TagCursorMapper.parse(query.cursor) : null,
    };
    return this.tagApplicationService.listTags(command);
  }

  @Get(':slug')
  @Public()
  @ApiPublicList({ description: 'Tag found', type: TagWrappedTagDto })
  @ApiNotFoundResponse({ description: 'Tag not found' })
  @ApiInternalServerErrorResponse()
  getTagBySlug(@Param('slug') slug: string) {
    return this.tagApplicationService.getTagBySlug(slug);
  }

  @Post()
  @Permissions(Permission.TAG_MANAGE)
  @ApiAuthCreate({ description: 'Tag created', type: TagWrappedTagDto })
  createTag(@Body() payload: CreateTagDto) {
    const command: CreateTagCommand = { name: payload.name, slug: payload.slug };
    return this.tagApplicationService.createTag(command);
  }

  @Patch(':id')
  @Permissions(Permission.TAG_MANAGE)
  @ApiAuthUpdate({ description: 'Tag updated', type: TagWrappedTagDto })
  @ApiNotFoundResponse({ description: 'Tag not found' })
  updateTag(@Param('id', new ParseUUIDPipe()) tagId: string, @Body() payload: UpdateTagDto) {
    const command: UpdateTagCommand = { name: payload.name, slug: payload.slug };
    return this.tagApplicationService.updateTag(tagId, command);
  }

  @Delete(':id')
  @Permissions(Permission.TAG_MANAGE)
  @ApiAuth()
  @ApiOperation({ summary: 'Delete tag' })
  @ApiOkResponse({ description: 'Tag deleted', type: TagWrappedDeleteMessageDto })
  @ApiNotFoundResponse({ description: 'Tag not found' })
  deleteTag(@Param('id', new ParseUUIDPipe()) tagId: string) {
    return this.tagApplicationService.deleteTag(tagId);
  }
}
