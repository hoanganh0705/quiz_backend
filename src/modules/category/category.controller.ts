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
} from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import { Roles } from '@/common/authorization/decorators/roles.decorator';
import { CreateCategoryDto } from './dto/request/create-category.dto';
import { ListCategoriesQueryDto } from './dto/request/list-categories-query.dto';
import { UpdateCategoryDto } from './dto/request/update-category.dto';
import { CategoryListResponseDto } from './dto/response/category-list-response.dto';
import { CategoryResponseDto } from './dto/response/category-response.dto';
import { DeleteCategoryResponseDto } from './dto/response/delete-category-response.dto';
import { CategoryApplicationService } from './application/category.application.service';
import { CategoryDomainExceptionFilter } from './transport/filters/category-domain-exception.filter';
import { CategoryCursorMapper } from './mappers/category-cursor.mapper';
import type {
  CreateCategoryCommand,
  ListCategoriesQuery,
  UpdateCategoryCommand,
} from './domain/types/category-commands';

@ApiTags('categories')
@Controller('categories')
@UseFilters(CategoryDomainExceptionFilter)
export class CategoryController {
  constructor(private readonly categoryApplicationService: CategoryApplicationService) {}

  @Get()
  @Public()
  @ApiOperation({
    summary: 'List categories',
    description: 'Returns a paginated, cursor-based list of active categories.',
  })
  @ApiOkResponse({ description: 'Categories returned', type: CategoryListResponseDto })
  listCategories(@Query() query: ListCategoriesQueryDto): Promise<CategoryListResponseDto> {
    const command: ListCategoriesQuery = {
      limit: query.limit,
      cursor: query.cursor ? CategoryCursorMapper.parse(query.cursor) : null,
    };

    return this.categoryApplicationService.listCategories(command);
  }

  @Get(':slug')
  @Public()
  @ApiOperation({
    summary: 'Get category by slug',
    description: 'Returns a single active category by its URL slug.',
  })
  @ApiOkResponse({ description: 'Category found', type: CategoryResponseDto })
  @ApiNotFoundResponse({ description: 'Category not found' })
  getCategoryBySlug(@Param('slug') slug: string): Promise<CategoryResponseDto> {
    return this.categoryApplicationService.getCategoryBySlug(slug);
  }

  @Post()
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create category',
    description: 'Creates a new quiz category. Requires admin role.',
  })
  @ApiCreatedResponse({ description: 'Category created', type: CategoryResponseDto })
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
  @ApiOperation({
    summary: 'Update category',
    description: 'Updates an existing category by ID. Requires admin role.',
  })
  @ApiOkResponse({ description: 'Category updated', type: CategoryResponseDto })
  @ApiNotFoundResponse({ description: 'Category not found' })
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
  @ApiOperation({
    summary: 'Delete category',
    description: 'Soft-deletes a category. Requires admin role.',
  })
  @ApiOkResponse({ description: 'Category deleted', type: DeleteCategoryResponseDto })
  @ApiNotFoundResponse({ description: 'Category not found' })
  deleteCategory(
    @Param('id', new ParseUUIDPipe()) categoryId: string,
  ): Promise<DeleteCategoryResponseDto> {
    return this.categoryApplicationService.deleteCategory(categoryId);
  }
}
