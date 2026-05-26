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
import { CategoryService } from './category.service';

@ApiTags('categories')
@Controller('categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get()
  @Public()
  @ApiOperation({
    summary: 'List categories',
    description: 'Returns a paginated, cursor-based list of active categories.',
  })
  @ApiOkResponse({ description: 'Categories returned', type: CategoryListResponseDto })
  listCategories(@Query() query: ListCategoriesQueryDto): Promise<CategoryListResponseDto> {
    return this.categoryService.listActiveCategories(query);
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
    return this.categoryService.getActiveCategoryBySlug(slug);
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
    return this.categoryService.createCategory(payload);
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
    return this.categoryService.updateCategoryById(categoryId, payload);
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
    return this.categoryService.softDeleteCategoryById(categoryId);
  }
}
