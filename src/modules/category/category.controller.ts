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
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateCategoryDto } from './dto/request/create-category.dto';
import { ListCategoriesQueryDto } from './dto/request/list-categories-query.dto';
import { UpdateCategoryDto } from './dto/request/update-category.dto';
import { CategoryListResponseDto } from './dto/response/category-list-response.dto';
import { CategoryResponseDto } from './dto/response/category-response.dto';
import { DeleteCategoryResponseDto } from './dto/response/delete-category-response.dto';
import { CategoryService } from './category.service';

@Controller(['category', 'categories'])
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get()
  listCategories(@Query() query: ListCategoriesQueryDto): Promise<CategoryListResponseDto> {
    return this.categoryService.listActiveCategories(query);
  }

  @Get(':slug')
  getCategoryBySlug(@Param('slug') slug: string): Promise<CategoryResponseDto> {
    return this.categoryService.getActiveCategoryBySlug(slug);
  }

  @Post()
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin')
  createCategory(@Body() payload: CreateCategoryDto): Promise<CategoryResponseDto> {
    return this.categoryService.createCategory(payload);
  }

  @Patch(':id')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin')
  updateCategory(
    @Param('id', new ParseUUIDPipe()) categoryId: string,
    @Body() payload: UpdateCategoryDto,
  ): Promise<CategoryResponseDto> {
    return this.categoryService.updateCategoryById(categoryId, payload);
  }

  @Delete(':id')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin')
  deleteCategory(
    @Param('id', new ParseUUIDPipe()) categoryId: string,
  ): Promise<DeleteCategoryResponseDto> {
    return this.categoryService.softDeleteCategoryById(categoryId);
  }
}
