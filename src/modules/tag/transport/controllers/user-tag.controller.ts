import { Controller, Get, Query, UseFilters } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiBearerAuth,
  ApiInternalServerErrorResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { ApiAuth } from '@/common/swagger/swagger-decorators';
import { ListFollowedTagsQueryDto } from '../../dto/request/list-followed-tags-query.dto';
import { TagApplicationService } from '../../application/tag.application.service';
import { TagDomainExceptionFilter } from '../filters/tag-domain-exception.filter';
import { FollowedTagCursorMapper } from '../../mappers/followed-tag-cursor.mapper';
import { TagWrappedFollowedListDto } from '../../dto/response/tag-response-docs.dto';

/**
 * Hosts the /users/me/followed-tags route.
 * Uses @Controller() with no base path so NestJS registers the full path
 * `/users/me/followed-tags` without conflicting with TagController's
 * `:slug` wildcard route.
 */
@ApiTags('users')
@Controller()
@UseFilters(TagDomainExceptionFilter)
export class UserTagController {
  constructor(private readonly tagApplicationService: TagApplicationService) {}

  @Get('users/me/followed-tags')
  @ApiBearerAuth()
  @ApiAuth()
  @ApiOperation({
    summary: 'My followed tags',
    description:
      'Returns the list of tags the authenticated user follows, cursor-paginated and ordered by most recently followed.',
  })
  @ApiOkResponse({
    description: 'Followed tags returned',
    type: TagWrappedFollowedListDto,
  })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  listFollowedTags(@CurrentUser() user: JwtPayload, @Query() query: ListFollowedTagsQueryDto) {
    const cursor = query.cursor ? FollowedTagCursorMapper.parse(query.cursor) : null;

    return this.tagApplicationService.listFollowedTags(user.sub, {
      limit: query.limit,
      cursor,
    });
  }
}
