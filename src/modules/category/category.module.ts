import { Module } from '@nestjs/common';
import { CategoryController } from './category.controller';
import { CategoryApplicationService } from './application/category.application.service';
import { CategoryDomainService } from './domain/category.service';
import { CategoryRepository } from './infrastructure/repositories/category.repository';
import { DatabaseModule } from '@/core/database/database.module';
import { CATEGORY_REPOSITORY_PORT } from './domain/ports';
import { CategoryResponseMapper } from './mappers/category-response.mapper';
import { CategoryCursorMapper } from './mappers/category-cursor.mapper';
@Module({
  imports: [DatabaseModule],
  controllers: [CategoryController, CategoryResponseMapper, CategoryCursorMapper],
  providers: [
    CategoryApplicationService,
    CategoryDomainService,
    CategoryRepository,
    { provide: CATEGORY_REPOSITORY_PORT, useClass: CategoryRepository },
  ],
  exports: [CategoryApplicationService, CATEGORY_REPOSITORY_PORT],
})
export class CategoryModule {}
