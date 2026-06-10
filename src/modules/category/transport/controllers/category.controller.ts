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
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiInternalServerErrorResponse,
} from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import { Roles } from '@/common/authorization/decorators/roles.decorator';
import { ApiAuth, ApiValidationRequest } from '@/common/swagger/swagger-decorators';
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
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
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
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  getTrendingCategories(
    @Query() query: CategoryRankingQueryDto,
  ): Promise<RankedCategoriesResponseDto> {
    return this.categoryQueryService.getTrendingCategories({ limit: query.limit ?? 10 });
  }

  @Get(':slug/quizzes')
  @Public()
  @ApiOperation({
    summary: 'List quizzes in a category',
    description:
      'Returns the same quiz list response as GET /quizzes, filtered to the given category slug.',
  })
  @ApiOkResponse({ description: 'Quizzes returned' })
  @ApiNotFoundResponse({ description: 'Category not found' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  getCategoryQuizzes(@Param('slug') slug: string, @Query() query: ListQuizzesQueryDto) {
    return this.categoryQueryService.getCategoryQuizzesBySlug(slug, query);
  }

  @Get(':slug/related')
  @Public()
  @ApiOperation({
    summary: 'Related categories',
    description: 'Returns active categories related to the given category slug.',
  })
  @ApiOkResponse({ description: 'Related categories returned', type: RelatedCategoriesResponseDto })
  @ApiNotFoundResponse({ description: 'Category not found' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  getRelatedCategories(
    @Param('slug') slug: string,
    @Query() query: RelatedCategoriesQueryDto,
  ): Promise<RelatedCategoriesResponseDto> {
    return this.categoryQueryService.getRelatedCategories(slug, { limit: query.limit ?? 10 });
  }

  @Get(':id/analytics')
  @Public()
  @ApiOperation({
    summary: 'Category analytics',
    description: 'Returns aggregated analytics for all quizzes in the category.',
  })
  @ApiOkResponse({ description: 'Analytics returned', type: CategoryAnalyticsResponseDto })
  @ApiNotFoundResponse({ description: 'Category or analytics not found' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  getCategoryAnalytics(
    @Param('id', new ParseUUIDPipe()) categoryId: string,
  ): Promise<CategoryAnalyticsResponseDto> {
    return this.categoryQueryService.getCategoryAnalytics(categoryId);
  }

  @Post(':id/follow')
  @ApiBearerAuth()
  @ApiAuth()
  @ApiOperation({
    summary: 'Follow a category',
    description: 'Adds the authenticated user to the category followers. Idempotent.',
  })
  @ApiOkResponse({ description: 'Category followed', type: MessageResponseDto })
  @ApiNotFoundResponse({ description: 'Category not found' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  followCategory(
    @Param('id', new ParseUUIDPipe()) categoryId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<MessageResponseDto> {
    return this.categoryApplicationService.followCategory(user.sub, categoryId);
  }

  @Delete(':id/follow')
  @ApiBearerAuth()
  @ApiAuth()
  @ApiOperation({
    summary: 'Unfollow a category',
    description: 'Removes the authenticated user from the category followers. Idempotent.',
  })
  @ApiOkResponse({ description: 'Category unfollowed', type: MessageResponseDto })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  unfollowCategory(
    @Param('id', new ParseUUIDPipe()) categoryId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<MessageResponseDto> {
    return this.categoryApplicationService.unfollowCategory(user.sub, categoryId);
  }

  @Post(':id/restore')
  @Roles('admin')
  @ApiBearerAuth()
  @ApiAuth()
  @ApiOperation({
    summary: 'Restore category',
    description: 'Restores a soft-deleted category. Requires admin role.',
  })
  @ApiOkResponse({ description: 'Category restored', type: CategoryResponseDto })
  @ApiNotFoundResponse({ description: 'Category not found' })
  @ApiConflictResponse({ description: 'Category already active or slug conflict' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  restoreCategory(
    @Param('id', new ParseUUIDPipe()) categoryId: string,
  ): Promise<CategoryResponseDto> {
    return this.categoryApplicationService.restoreCategory(categoryId);
  }

  @Get()
  @Public()
  @ApiOperation({
    summary: 'List categories',
    description: 'Returns a paginated, cursor-based list of active categories.',
  })
  @ApiOkResponse({ description: 'Categories returned', type: CategoryListResponseDto })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  listCategories(@Query() query: ListCategoriesQueryDto): Promise<CategoryListResponseDto> {
    const command: ListCategoriesQuery = {
      limit: query.limit,
      cursor: query.cursor ? CategoryCursorMapper.parse(query.cursor) : null,
    };

    return this.categoryQueryService.listCategories(command);
  }

  @Get(':id')
  @Public()
  @ApiOperation({
    summary: 'Get category by ID',
    description: 'Returns a single active category by its UUID.',
  })
  @ApiOkResponse({ description: 'Category found', type: CategoryResponseDto })
  @ApiNotFoundResponse({ description: 'Category not found' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  getCategoryById(
    @Param('id', new ParseUUIDPipe()) categoryId: string,
  ): Promise<CategoryResponseDto> {
    return this.categoryQueryService.getCategoryById(categoryId);
  }

  @Get(':slug')
  @Public()
  @ApiOperation({
    summary: 'Get category by slug',
    description: 'Returns a single active category by its URL slug.',
  })
  @ApiOkResponse({ description: 'Category found', type: CategoryResponseDto })
  @ApiNotFoundResponse({ description: 'Category not found' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  getCategoryBySlug(@Param('slug') slug: string): Promise<CategoryResponseDto> {
    return this.categoryQueryService.getCategoryBySlug(slug);
  }

  @Post()
  @Roles('admin')
  @ApiBearerAuth()
  @ApiAuth()
  @ApiOperation({
    summary: 'Create category',
    description: 'Creates a new quiz category. Requires admin role.',
  })
  @ApiCreatedResponse({ description: 'Category created', type: CategoryResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiNotFoundResponse({ description: 'Category not found' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  @ApiValidationRequest()
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
  @Roles('admin')
  @ApiBearerAuth()
  @ApiAuth()
  @ApiOperation({
    summary: 'Update category',
    description: 'Updates an existing category by ID. Requires admin role.',
  })
  @ApiOkResponse({ description: 'Category updated', type: CategoryResponseDto })
  @ApiNotFoundResponse({ description: 'Category not found' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  @ApiValidationRequest()
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
  @Roles('admin')
  @ApiBearerAuth()
  @ApiAuth()
  @ApiOperation({
    summary: 'Delete category',
    description: 'Soft deletes a category by ID. Requires admin role.',
  })
  @ApiOkResponse({ description: 'Category deleted', type: MessageResponseDto })
  @ApiNotFoundResponse({ description: 'Category not found' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  deleteCategory(
    @Param('id', new ParseUUIDPipe()) categoryId: string,
  ): Promise<MessageResponseDto> {
    return this.categoryApplicationService.deleteCategory(categoryId);
  }
}
