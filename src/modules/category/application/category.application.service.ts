import { Injectable } from '@nestjs/common';
import { CategoryDomainService } from '../domain/category.service';
import { CategoryResponseMapper } from '../mappers/category-response.mapper';
import { CreateCategoryDto } from '../dto/request/create-category.dto';
import { UpdateCategoryDto } from '../dto/request/update-category.dto';
import { ListCategoriesQueryDto } from '../dto/request/list-categories-query.dto';
import type { CategoryListResponseDto } from '../dto/response/category-list-response.dto';
import type { CategoryResponseDto } from '../dto/response/category-response.dto';
import type { DeleteCategoryResponseDto } from '../dto/response/delete-category-response.dto';

@Injectable()
export class CategoryApplicationService {
  constructor(private readonly categoryDomainService: CategoryDomainService) {}

  async listCategories(query: ListCategoriesQueryDto): Promise<CategoryListResponseDto> {
    const { items, limit, hasNextPage, nextCursor } =
      await this.categoryDomainService.listCategories(query);

    return {
      items: items.map((item) => CategoryResponseMapper.toResponse(item)),
      pagination: { limit, hasNextPage, nextCursor },
    };
  }

  async getCategoryBySlug(slug: string): Promise<CategoryResponseDto> {
    const row = await this.categoryDomainService.getCategoryBySlug(slug);
    return CategoryResponseMapper.toResponse(row);
  }

  async createCategory(payload: CreateCategoryDto): Promise<CategoryResponseDto> {
    const row = await this.categoryDomainService.createCategory(payload);
    return CategoryResponseMapper.toResponse(row);
  }

  async updateCategory(
    categoryId: string,
    payload: UpdateCategoryDto,
  ): Promise<CategoryResponseDto> {
    const row = await this.categoryDomainService.updateCategory(categoryId, payload);
    return CategoryResponseMapper.toResponse(row);
  }

  async deleteCategory(categoryId: string): Promise<DeleteCategoryResponseDto> {
    await this.categoryDomainService.deleteCategory(categoryId);
    return { message: 'Category deleted successfully' };
  }
}
