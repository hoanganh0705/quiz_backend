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
import { ApiTags, ApiOperation, ApiOkResponse, ApiNotFoundResponse, ApiInternalServerErrorResponse } from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import { Permissions } from '@/common/authorization/decorators/permissions.decorator';
import { Permission } from '@/common/authorization/permissions';
import {
  ApiAuth,
  ApiAuthCreate,
  ApiAuthUpdate,
  ApiAuthDelete,
  ApiPublicList,
  ApiConflict,
  ApiInternalError,
} from '@/common/swagger/swagger-decorators';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { CreateCategoryDto } from '../../dto/request/create-category.dto';
import { ListCategoriesQueryDto } from '../../dto/request/list-categories-query.dto';
import { UpdateCategoryDto } from '../../dto/request/update-category.dto';
import { CategoryRankingQueryDto } from '../../dto/request/category-ranking-query.dto';
import { RelatedCategoriesQueryDto } from '../../dto/request/related-categories-query.dto';
import { ListQuizzesQueryDto } from '../../../quiz/dto/request/list-quizzes-query.dto';
import { CategoryListResponseDto } from '../../dto/response/category-list-response.dto';
import { CategoryResponseDto } from '../../dto/response/category-response.dto';
import { MessageResponseDto } from '../../dto/response/message-response.dto';
import { RankedCategoriesResponseDto } from '../../dto/response/ranked-categories-response.dto';
import { CategoryAnalyticsResponseDto } from '../../dto/response/category-analytics-response.dto';
import { RelatedCategoriesResponseDto } from '../../dto/response/related-categories-response.dto';
import { CategoryApplicationService } from '../../application/category.application.service';
import { CategoryQueryService } from '../../application/category-query.service';
import { CategoryDomainExceptionFilter } from '../filters/category-domain-exception.filter';
import { CategoryCursorMapper } from '../../mappers/category-cursor.mapper';
import type {
  CreateCategoryCommand,
  ListCategoriesQuery,
  UpdateCategoryCommand,
} from '../../domain/types/category-commands';

@ApiTags('categories')
@Controller('categories')
@UseFilters(CategoryDomainExceptionFilter)
export class CategoryController {
  constructor(
    private readonly categoryApplicationService: CategoryApplicationService,
    private readonly categoryQueryService: CategoryQueryService,
  ) {}

  @Get('popular')
  @Public()
  @ApiOperation({
    summary: 'Popular categories',
    description: 'Returns categories ranked by aggregated quiz popularity score.',
  })
  @ApiOkResponse({ description: 'Ranked categories returned', type: RankedCategoriesResponseDto })
  @ApiInternalServerErrorResponse()
  getPopularCategories(
    @Query() query: CategoryRankingQueryDto,
  ): Promise<RankedCategoriesResponseDto> {
    return this.categoryQueryService.getPopularCategories({ limit: query.limit ?? 10 });
  }

  @Get('trending')
  @Public()
  @ApiOperation({
    summary: 'Trending categories',
    description: 'Returns categories ranked by aggregated quiz trending score.',
  })
  @ApiOkResponse({ description: 'Ranked categories returned', type: RankedCategoriesResponseDto })
  @ApiInternalServerErrorResponse()
  getTrendingCategories(
    @Query() query: CategoryRankingQueryDto,
  ): Promise<RankedCategoriesResponseDto> {
    return this.categoryQueryService.getTrendingCategories({ limit: query.limit ?? 10 });
  }

  @Get(':slug/quizzes')
  @Public()
  @ApiPublicList()
  getCategoryQuizzes(@Param('slug') slug: string, @Query() query: ListQuizzesQueryDto) {
    return this.categoryQueryService.getCategoryQuizzesBySlug(slug, query);
  }

  @Get(':slug/related')
  @Public()
  @ApiPublicList({ description: 'Related categories returned', type: RelatedCategoriesResponseDto })
  getRelatedCategories(
    @Param('slug') slug: string,
    @Query() query: RelatedCategoriesQueryDto,
  ): Promise<RelatedCategoriesResponseDto> {
    return this.categoryQueryService.getRelatedCategories(slug, { limit: query.limit ?? 10 });
  }

  @Get(':id/analytics')
  @Public()
  @ApiPublicList({ description: 'Analytics returned', type: CategoryAnalyticsResponseDto })
  getCategoryAnalytics(
    @Param('id', new ParseUUIDPipe()) categoryId: string,
  ): Promise<CategoryAnalyticsResponseDto> {
    return this.categoryQueryService.getCategoryAnalytics(categoryId);
  }

  @Post(':id/follow')
  @ApiAuth()
  @ApiOperation({
    summary: 'Follow a category',
    description: 'Adds the authenticated user to the category followers. Idempotent.',
  })
  @ApiOkResponse({ description: 'Category followed', type: MessageResponseDto })
  @ApiNotFoundResponse()
  @ApiInternalServerErrorResponse()
  followCategory(
    @Param('id', new ParseUUIDPipe()) categoryId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<MessageResponseDto> {
    return this.categoryApplicationService.followCategory(user.sub, categoryId);
  }

  @Delete(':id/follow')
  @ApiAuth()
  @ApiOperation({
    summary: 'Unfollow a category',
    description: 'Removes the authenticated user from the category followers. Idempotent.',
  })
  @ApiOkResponse({ description: 'Category unfollowed', type: MessageResponseDto })
  @ApiInternalServerErrorResponse()
  unfollowCategory(
    @Param('id', new ParseUUIDPipe()) categoryId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<MessageResponseDto> {
    return this.categoryApplicationService.unfollowCategory(user.sub, categoryId);
  }

  @Post(':id/restore')
  @Permissions(Permission.CATEGORY_MANAGE)
  @ApiAuth()
  @ApiOperation({
    summary: 'Restore category',
    description: 'Restores a soft-deleted category. Requires admin role.',
  })
  @ApiOkResponse({ description: 'Category restored', type: CategoryResponseDto })
  @ApiNotFoundResponse()
  @ApiConflict()
  @ApiInternalServerErrorResponse()
  restoreCategory(
    @Param('id', new ParseUUIDPipe()) categoryId: string,
  ): Promise<CategoryResponseDto> {
    return this.categoryApplicationService.restoreCategory(categoryId);
  }

  @Get()
  @Public()
  @ApiPublicList({ description: 'Categories returned', type: CategoryListResponseDto })
  listCategories(@Query() query: ListCategoriesQueryDto): Promise<CategoryListResponseDto> {
    const command: ListCategoriesQuery = {
      limit: query.limit,
      cursor: query.cursor ? CategoryCursorMapper.parse(query.cursor) : null,
    };

    return this.categoryQueryService.listCategories(command);
  }

  @Get(':id')
  @Public()
  @ApiPublicList({ description: 'Category found', type: CategoryResponseDto })
  getCategoryById(
    @Param('id', new ParseUUIDPipe()) categoryId: string,
  ): Promise<CategoryResponseDto> {
    return this.categoryQueryService.getCategoryById(categoryId);
  }

  @Get(':slug')
  @Public()
  @ApiPublicList({ description: 'Category found', type: CategoryResponseDto })
  getCategoryBySlug(@Param('slug') slug: string): Promise<CategoryResponseDto> {
    return this.categoryQueryService.getCategoryBySlug(slug);
  }

  @Post()
  @Permissions(Permission.CATEGORY_MANAGE)
  @ApiAuthCreate({ description: 'Category created', type: CategoryResponseDto })
  createCategory(@Body() payload: CreateCategoryDto): Promise<CategoryResponseDto> {
    const command: CreateCategoryCommand = {
      name: payload.name,
      description: payload.description,
      slug: payload.slug,
      imageUrl: payload.imageUrl,
    };

    return this.categoryApplicationService.createCategory(command);
  }

  @Patch(':id')
  @Permissions(Permission.CATEGORY_MANAGE)
  @ApiAuthUpdate({ description: 'Category updated', type: CategoryResponseDto })
  updateCategory(
    @Param('id', new ParseUUIDPipe()) categoryId: string,
    @Body() payload: UpdateCategoryDto,
  ): Promise<CategoryResponseDto> {
    const command: UpdateCategoryCommand = {
      name: payload.name,
      description: payload.description,
      slug: payload.slug,
      imageUrl: payload.imageUrl,
    };

    return this.categoryApplicationService.updateCategory(categoryId, command);
  }

  @Delete(':id')
  @Permissions(Permission.CATEGORY_MANAGE)
  @ApiAuthDelete('Category deleted')
  deleteCategory(
    @Param('id', new ParseUUIDPipe()) categoryId: string,
  ): Promise<MessageResponseDto> {
    return this.categoryApplicationService.deleteCategory(categoryId);
  }
}
