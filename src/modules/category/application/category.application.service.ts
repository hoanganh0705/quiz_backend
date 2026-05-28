import { Injectable } from '@nestjs/common';
import { CategoryDomainService } from '../domain/category.service';
import { CategoryResponseMapper } from '../mappers/category-response.mapper';
import { CategoryCursorMapper } from '../mappers/category-cursor.mapper';
import type { CategoryListResponseDto } from '../dto/response/category-list-response.dto';
import type { CategoryResponseDto } from '../dto/response/category-response.dto';
import type { DeleteCategoryResponseDto } from '../dto/response/delete-category-response.dto';
import type {
  CreateCategoryCommand,
  ListCategoriesQuery,
  UpdateCategoryCommand,
} from '../domain/types/category-commands';

@Injectable()
export class CategoryApplicationService {
  constructor(private readonly categoryDomainService: CategoryDomainService) {}

  async listCategories(query: ListCategoriesQuery): Promise<CategoryListResponseDto> {
    const { items, limit, hasNextPage, nextCursor } =
      await this.categoryDomainService.listCategories(query);

    return {
      items: items.map((item) => CategoryResponseMapper.toResponse(item)),
      pagination: {
        limit,
        hasNextPage,
        nextCursor: nextCursor ? CategoryCursorMapper.serialize(nextCursor) : null,
      },
    };
  }

  async getCategoryBySlug(slug: string): Promise<CategoryResponseDto> {
    const row = await this.categoryDomainService.getCategoryBySlug(slug);
    return CategoryResponseMapper.toResponse(row);
  }

  async createCategory(payload: CreateCategoryCommand): Promise<CategoryResponseDto> {
    const row = await this.categoryDomainService.createCategory(payload);
    return CategoryResponseMapper.toResponse(row);
  }

  async updateCategory(
    categoryId: string,
    payload: UpdateCategoryCommand,
  ): Promise<CategoryResponseDto> {
    const row = await this.categoryDomainService.updateCategory(categoryId, payload);
    return CategoryResponseMapper.toResponse(row);
  }

  async deleteCategory(categoryId: string): Promise<DeleteCategoryResponseDto> {
    await this.categoryDomainService.deleteCategory(categoryId);
    return { message: 'Category deleted successfully' };
  }
}
