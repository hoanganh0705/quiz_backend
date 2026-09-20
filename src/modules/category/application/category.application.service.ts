import { Injectable } from '@nestjs/common';
import { CategoryDomainService } from '../domain/category.service';
import { CategoryResponseMapper } from '../mappers/category-response.mapper';
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
    return CategoryResponseMapper.toResponse(row);
  }

  async updateCategory(
    categoryId: string,
    payload: UpdateCategoryCommand,
  ): Promise<CategoryResponseDto> {
    const row = await this.categoryDomainService.updateCategory(categoryId, payload);
    return CategoryResponseMapper.toResponse(row);
  }

  async deleteCategory(categoryId: string): Promise<MessageResponseDto> {
    await this.categoryDomainService.deleteCategory(categoryId);
    return { message: 'Category deleted successfully' };
  }

  async restoreCategory(categoryId: string): Promise<CategoryResponseDto> {
    const row = await this.categoryDomainService.restoreCategory(categoryId);
    return CategoryResponseMapper.toResponse(row);
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
