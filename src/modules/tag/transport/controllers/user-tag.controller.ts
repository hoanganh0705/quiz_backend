import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { ListFollowedTagsQueryDto } from '../../dto/request/list-followed-tags-query.dto';
import { TagApplicationService } from '../../application/tag.application.service';
import { FollowedTagCursorMapper } from '../../mappers/followed-tag-cursor.mapper';
import { TagPresenter } from '../presenters/tag.presenter';
import { ApiFollowedTagsResponse } from '../swagger/tag-swagger-decorators';

/**
 * Hosts the /users/me/followed-tags route.
 * Uses @Controller() with no base path so NestJS registers the full path
 * `/users/me/followed-tags` without conflicting with TagController's
 * `:slug` wildcard route.
 */
@ApiTags('users')
@Controller()
export class UserTagController {
  constructor(
    private readonly tagApplicationService: TagApplicationService,
    private readonly presenter: TagPresenter,
  ) {}

  @Get('users/me/followed-tags')
  @ApiOperation({ summary: 'List tags followed by the authenticated user' })
  @ApiFollowedTagsResponse()
  async listFollowedTags(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListFollowedTagsQueryDto,
  ) {
    const cursor = query.cursor ? FollowedTagCursorMapper.parse(query.cursor) : null;

    const result = await this.tagApplicationService.listFollowedTags(user.sub, {
      limit: query.limit,
      cursor,
    });
    return this.presenter.listFollowedTags(result);
  }
}
