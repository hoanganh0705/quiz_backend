import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { ListFollowedCategoriesQueryDto } from '../../dto/request/list-followed-categories-query.dto';
import { CategoryQueryService } from '../../application/category-query.service';
import { FollowedCategoryCursorMapper } from '../../mappers/followed-category-cursor.mapper';
import { ApiFollowedCategoriesResponse } from '../swagger/category-swagger-decorators';

/**
 * Hosts the /users/me/followed-categories route.
 *
 * Uses @Controller() with no base path so NestJS registers the full path
 * `/users/me/followed-categories` without conflicting with the
 * CategoryController's `categories/:slug` wildcard route.
 */
@ApiTags('users')
@Controller()
export class UserCategoryController {
  constructor(private readonly categoryQueryService: CategoryQueryService) {}

  @Get('users/me/followed-categories')
  @ApiFollowedCategoriesResponse()
  listFollowedCategories(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListFollowedCategoriesQueryDto,
  ) {
    const cursor = query.cursor ? FollowedCategoryCursorMapper.parse(query.cursor) : null;

    return this.categoryQueryService.listFollowedCategories(user.sub, {
      limit: query.limit,
      cursor,
    });
  }
}
