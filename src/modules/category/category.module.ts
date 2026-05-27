import { Module } from '@nestjs/common';
import { CategoryController } from './category.controller';
import { CategoryApplicationService } from './application/category.application.service';
import { CategoryDomainService } from './domain/category.service';
import { CategoryRepository } from './infrastructure/category.repository';
import { DatabaseModule } from '@/core/database/database.module';
import { CATEGORY_REPOSITORY_PORT } from './domain/ports';

@Module({
  imports: [DatabaseModule],
  controllers: [CategoryController],
  providers: [
    CategoryApplicationService,
    CategoryDomainService,
    CategoryRepository,
    { provide: CATEGORY_REPOSITORY_PORT, useClass: CategoryRepository },
  ],
  exports: [CategoryApplicationService, CATEGORY_REPOSITORY_PORT],
})
export class CategoryModule {}
