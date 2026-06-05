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
import { ListFollowedCategoriesQueryDto } from '../../dto/request/list-followed-categories-query.dto';
import { FollowedCategoriesResponseDto } from '../../dto/response/followed-categories-response.dto';
import { CategoryApplicationService } from '../../application/category.application.service';
import { CategoryDomainExceptionFilter } from '../filters/category-domain-exception.filter';
import { FollowedCategoryCursorMapper } from '../../mappers/followed-category-cursor.mapper';

/**
 * Hosts the /users/me/followed-categories route.
 *
 * Uses @Controller() with no base path so NestJS registers the full path
 * `/users/me/followed-categories` without conflicting with the
 * CategoryController's `categories/:slug` wildcard route.
 */
@ApiTags('users')
@Controller()
@UseFilters(CategoryDomainExceptionFilter)
export class UserCategoryController {
  constructor(private readonly categoryApplicationService: CategoryApplicationService) {}

  @Get('users/me/followed-categories')
  @ApiBearerAuth()
  @ApiAuth()
  @ApiOperation({
    summary: 'My followed categories',
    description:
      'Returns the list of categories the authenticated user follows, cursor-paginated and ordered by most recently followed.',
  })
  @ApiOkResponse({
    description: 'Followed categories returned',
    type: FollowedCategoriesResponseDto,
  })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  listFollowedCategories(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListFollowedCategoriesQueryDto,
  ): Promise<FollowedCategoriesResponseDto> {
    const cursor = query.cursor ? FollowedCategoryCursorMapper.parse(query.cursor) : null;

    return this.categoryApplicationService.listFollowedCategories(user.sub, {
      limit: query.limit,
      cursor,
    });
  }
}
