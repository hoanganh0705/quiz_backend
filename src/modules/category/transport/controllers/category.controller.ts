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
import { CreateCategoryDto } from '../../dto/request/create-category.dto';
import { ListCategoriesQueryDto } from '../../dto/request/list-categories-query.dto';
import { UpdateCategoryDto } from '../../dto/request/update-category.dto';
import { CategoryRankingQueryDto } from '../../dto/request/category-ranking-query.dto';
import { RelatedCategoriesQueryDto } from '../../dto/request/related-categories-query.dto';
import { ListQuizzesQueryDto } from '@/modules/quiz/dto/request/list-quizzes-query.dto';
import type {
  CreateCategoryCommand,
  ListCategoriesQuery,
  UpdateCategoryCommand,
} from '../../domain/types/category-commands';
import { CategoryApplicationService } from '../../application/category.application.service';
import { CategoryQueryService } from '../../application/category-query.service';
import { CategoryDomainExceptionFilter } from '../filters/category-domain-exception.filter';
import { CategoryCursorMapper } from '../../mappers/category-cursor.mapper';
import {
  ApiCategoryAnalyticsResponse,
  ApiCategoryByIdResponse,
  ApiCategoryBySlugResponse,
  ApiCategoryQuizzesResponse,
  ApiCreateCategoryResponse,
  ApiDeleteCategoryResponse,
  ApiFollowCategoryResponse,
  ApiListCategoriesResponse,
  ApiPopularCategoriesResponse,
  ApiRelatedCategoriesResponse,
  ApiRestoreCategoryResponse,
  ApiTrendingCategoriesResponse,
  ApiUnfollowCategoryResponse,
  ApiUpdateCategoryResponse,
} from '../swagger/category-swagger-decorators';

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
  @ApiPopularCategoriesResponse()
  getPopularCategories(@Query() query: CategoryRankingQueryDto) {
    return this.categoryQueryService.getPopularCategories({ limit: query.limit ?? 10 });
  }

  @Get('trending')
  @Public()
  @ApiTrendingCategoriesResponse()
  getTrendingCategories(@Query() query: CategoryRankingQueryDto) {
    return this.categoryQueryService.getTrendingCategories({ limit: query.limit ?? 10 });
  }

  @Get(':slug/quizzes')
  @Public()
  @ApiCategoryQuizzesResponse()
  getCategoryQuizzes(@Param('slug') slug: string, @Query() query: ListQuizzesQueryDto) {
    return this.categoryQueryService.getCategoryQuizzesBySlug(slug, query);
  }

  @Get(':slug/related')
  @Public()
  @ApiRelatedCategoriesResponse()
  getRelatedCategories(@Param('slug') slug: string, @Query() query: RelatedCategoriesQueryDto) {
    return this.categoryQueryService.getRelatedCategories(slug, { limit: query.limit ?? 10 });
  }

  @Get(':id/analytics')
  @Public()
  @ApiCategoryAnalyticsResponse()
  getCategoryAnalytics(@Param('id', new ParseUUIDPipe()) categoryId: string) {
    return this.categoryQueryService.getCategoryAnalytics(categoryId);
  }

  @Post(':id/follow')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiFollowCategoryResponse()
  followCategory(
    @Param('id', new ParseUUIDPipe()) categoryId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.categoryApplicationService.followCategory(user.sub, categoryId);
  }

  @Delete(':id/follow')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiUnfollowCategoryResponse()
  unfollowCategory(
    @Param('id', new ParseUUIDPipe()) categoryId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.categoryApplicationService.unfollowCategory(user.sub, categoryId);
  }

  @Post(':id/restore')
  @Permissions(Permission.CATEGORY_MANAGE)
  @ApiRestoreCategoryResponse()
  restoreCategory(@Param('id', new ParseUUIDPipe()) categoryId: string) {
    return this.categoryApplicationService.restoreCategory(categoryId);
  }

  @Get()
  @Public()
  @ApiListCategoriesResponse()
  listCategories(@Query() query: ListCategoriesQueryDto) {
    const command: ListCategoriesQuery = {
      limit: query.limit,
      cursor: query.cursor ? CategoryCursorMapper.parse(query.cursor) : null,
    };

    return this.categoryQueryService.listCategories(command);
  }

  @Get(':id')
  @Public()
  @ApiCategoryByIdResponse()
  getCategoryById(@Param('id', new ParseUUIDPipe()) categoryId: string) {
    return this.categoryQueryService.getCategoryById(categoryId);
  }

  @Get(':slug')
  @Public()
  @ApiCategoryBySlugResponse()
  getCategoryBySlug(@Param('slug') slug: string) {
    return this.categoryQueryService.getCategoryBySlug(slug);
  }

  @Post()
  @Permissions(Permission.CATEGORY_MANAGE)
  @ApiCreateCategoryResponse()
  createCategory(@Body() payload: CreateCategoryDto) {
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
  @ApiUpdateCategoryResponse()
  updateCategory(
    @Param('id', new ParseUUIDPipe()) categoryId: string,
    @Body() payload: UpdateCategoryDto,
  ) {
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
  @ApiDeleteCategoryResponse()
  deleteCategory(@Param('id', new ParseUUIDPipe()) categoryId: string) {
    return this.categoryApplicationService.deleteCategory(categoryId);
  }
}
