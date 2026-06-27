import { Controller, Get, Query, UseFilters } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { ListFollowedTagsQueryDto } from '../../dto/request/list-followed-tags-query.dto';
import { TagApplicationService } from '../../application/tag.application.service';
import { TagDomainExceptionFilter } from '../filters/tag-domain-exception.filter';
import { FollowedTagCursorMapper } from '../../mappers/followed-tag-cursor.mapper';
import { ApiFollowedTagsResponse } from '../swagger/tag-swagger-decorators';

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
  @ApiFollowedTagsResponse()
  listFollowedTags(@CurrentUser() user: JwtPayload, @Query() query: ListFollowedTagsQueryDto) {
    const cursor = query.cursor ? FollowedTagCursorMapper.parse(query.cursor) : null;

    return this.tagApplicationService.listFollowedTags(user.sub, {
      limit: query.limit,
      cursor,
    });
  }
}
