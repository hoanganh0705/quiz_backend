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
import { ListCategoryQuizzesQueryDto } from '../../dto/request/list-category-quizzes-query.dto';
import type {
  CreateCategoryCommand,
  ListCategoriesQuery,
  UpdateCategoryCommand,
} from '../../domain/types/category-commands';
import { CategoryApplicationService } from '../../application/category.application.service';
import { CategoryQueryService } from '../../application/category-query.service';
import { CategoryPresenter } from '../presenters/category.presenter';
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
export class CategoryController {
  constructor(
    private readonly categoryApplicationService: CategoryApplicationService,
    private readonly categoryQueryService: CategoryQueryService,
    private readonly categoryPresenter: CategoryPresenter,
  ) {}

  @Get('popular')
  @Public()
  @ApiPopularCategoriesResponse()
  async getPopularCategories(@Query() query: CategoryRankingQueryDto) {
    const items = await this.categoryQueryService.getPopularCategories({
      limit: query.limit ?? 10,
    });
    return this.categoryPresenter.getPopularCategories(items);
  }

  @Get('trending')
  @Public()
  @ApiTrendingCategoriesResponse()
  async getTrendingCategories(@Query() query: CategoryRankingQueryDto) {
    const items = await this.categoryQueryService.getTrendingCategories({
      limit: query.limit ?? 10,
    });
    return this.categoryPresenter.getTrendingCategories(items);
  }

  @Get(':slug/quizzes')
  @Public()
  @ApiCategoryQuizzesResponse()
  async getCategoryQuizzes(
    @Param('slug') slug: string,
    @Query() query: ListCategoryQuizzesQueryDto,
  ) {
    const result = await this.categoryQueryService.getCategoryQuizzesBySlug(slug, query);
    return this.categoryPresenter.getCategoryQuizzesBySlug(result);
  }

  @Get(':slug/related')
  @Public()
  @ApiRelatedCategoriesResponse()
  async getRelatedCategories(
    @Param('slug') slug: string,
    @Query() query: RelatedCategoriesQueryDto,
  ) {
    const items = await this.categoryQueryService.getRelatedCategories(slug, {
      limit: query.limit ?? 10,
    });
    return this.categoryPresenter.getRelatedCategories(items);
  }

  @Get(':id/analytics')
  @Public()
  @ApiCategoryAnalyticsResponse()
  async getCategoryAnalytics(@Param('id', new ParseUUIDPipe()) categoryId: string) {
    const analytics = await this.categoryQueryService.getCategoryAnalytics(categoryId);
    return this.categoryPresenter.getCategoryAnalytics(analytics);
  }

  @Post(':id/follow')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiFollowCategoryResponse()
  async followCategory(
    @Param('id', new ParseUUIDPipe()) categoryId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.categoryApplicationService.followCategory(user.sub, categoryId);
    return this.categoryPresenter.followCategory(result);
  }

  @Delete(':id/follow')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiUnfollowCategoryResponse()
  async unfollowCategory(
    @Param('id', new ParseUUIDPipe()) categoryId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.categoryApplicationService.unfollowCategory(user.sub, categoryId);
    return this.categoryPresenter.unfollowCategory(result);
  }

  @Post(':id/restore')
  @Permissions(Permission.CATEGORY_MANAGE)
  @ApiRestoreCategoryResponse()
  async restoreCategory(@Param('id', new ParseUUIDPipe()) categoryId: string) {
    const result = await this.categoryApplicationService.restoreCategory(categoryId);
    return this.categoryPresenter.restoreCategory(result);
  }

  @Get()
  @Public()
  @ApiListCategoriesResponse()
  async listCategories(@Query() query: ListCategoriesQueryDto) {
    const command: ListCategoriesQuery = {
      limit: query.limit,
      cursor: query.cursor ? CategoryCursorMapper.parse(query.cursor) : null,
    };

    const result = await this.categoryQueryService.listCategories(command);
    return this.categoryPresenter.listCategories(result);
  }

  @Get(':id')
  @Public()
  @ApiCategoryByIdResponse()
  async getCategoryById(@Param('id', new ParseUUIDPipe()) categoryId: string) {
    const result = await this.categoryQueryService.getCategoryById(categoryId);
    return this.categoryPresenter.getCategoryById(result);
  }

  @Get(':slug')
  @Public()
  @ApiCategoryBySlugResponse()
  async getCategoryBySlug(@Param('slug') slug: string) {
    const result = await this.categoryQueryService.getCategoryBySlug(slug);
    return this.categoryPresenter.getCategoryBySlug(result);
  }

  @Post()
  @Permissions(Permission.CATEGORY_MANAGE)
  @ApiCreateCategoryResponse()
  async createCategory(@Body() payload: CreateCategoryDto) {
    const command: CreateCategoryCommand = {
      name: payload.name,
      description: payload.description,
      slug: payload.slug,
      imageUrl: payload.imageUrl,
    };

    const result = await this.categoryApplicationService.createCategory(command);
    return this.categoryPresenter.createCategory(result);
  }

  @Patch(':id')
  @Permissions(Permission.CATEGORY_MANAGE)
  @ApiUpdateCategoryResponse()
  async updateCategory(
    @Param('id', new ParseUUIDPipe()) categoryId: string,
    @Body() payload: UpdateCategoryDto,
  ) {
    const command: UpdateCategoryCommand = {
      name: payload.name,
      description: payload.description,
      slug: payload.slug,
      imageUrl: payload.imageUrl,
    };

    const result = await this.categoryApplicationService.updateCategory(categoryId, command);
    return this.categoryPresenter.updateCategory(result);
  }

  @Delete(':id')
  @Permissions(Permission.CATEGORY_MANAGE)
  @ApiDeleteCategoryResponse()
  async deleteCategory(@Param('id', new ParseUUIDPipe()) categoryId: string) {
    const result = await this.categoryApplicationService.deleteCategory(categoryId);
    return this.categoryPresenter.deleteCategory(result);
  }
}
