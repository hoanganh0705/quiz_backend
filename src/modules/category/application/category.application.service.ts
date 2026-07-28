import { Injectable } from '@nestjs/common';
import { CategoryDomainService } from '../domain/category.service';
import type { CategoryResponseDto } from '../dto/response/category-response.dto';
import type { MessageResponseDto } from '@/common/swagger/swagger-schemas';
import type {
  CreateCategoryCommand,
  UpdateCategoryCommand,
} from '../domain/types/category-commands';

/**
 * Write side of the Category bounded context.
 *
 * CQRS: this service is responsible exclusively for command (write) operations.
 * Read operations are delegated to CategoryQueryService.
 */
@Injectable()
export class CategoryApplicationService {
  constructor(private readonly categoryDomainService: CategoryDomainService) {}

  async createCategory(payload: CreateCategoryCommand): Promise<CategoryResponseDto> {
    const row = await this.categoryDomainService.createCategory(payload);
    return {
      categoryId: row.categoryId,
      name: row.name,
      description: row.description,
      slug: row.slug,
      imageUrl: row.imageUrl,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async updateCategory(
    categoryId: string,
    payload: UpdateCategoryCommand,
  ): Promise<CategoryResponseDto> {
    const row = await this.categoryDomainService.updateCategory(categoryId, payload);
    return {
      categoryId: row.categoryId,
      name: row.name,
      description: row.description,
      slug: row.slug,
      imageUrl: row.imageUrl,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async deleteCategory(_categoryId: string): Promise<MessageResponseDto> {
    await this.categoryDomainService.deleteCategory(_categoryId);
    return { message: 'Category deleted successfully' };
  }

  async restoreCategory(categoryId: string): Promise<CategoryResponseDto> {
    const row = await this.categoryDomainService.restoreCategory(categoryId);
    return {
      categoryId: row.categoryId,
      name: row.name,
      description: row.description,
      slug: row.slug,
      imageUrl: row.imageUrl,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async followCategory(userId: string, categoryId: string): Promise<MessageResponseDto> {
    await this.categoryDomainService.followCategory(userId, categoryId);
    return { message: 'Category followed successfully' };
  }

  async unfollowCategory(userId: string, categoryId: string): Promise<MessageResponseDto> {
    await this.categoryDomainService.unfollowCategory(userId, categoryId);
    return { message: 'Category unfollowed successfully' };
  }
}
