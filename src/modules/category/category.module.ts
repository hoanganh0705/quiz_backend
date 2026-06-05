import { Module } from '@nestjs/common';
import { CategoryController } from './category.controller';
import { UserCategoryController } from './transport/controllers/user-category.controller';
import { CategoryApplicationService } from './application/category.application.service';
import { CategoryDomainService } from './domain/category.service';
import { CategoryRepository } from './infrastructure/repositories/category.repository';
import { DatabaseModule } from '@/core/database/database.module';
import { QuizModule } from '@/modules/quiz/quiz.module';
import { CATEGORY_REPOSITORY_PORT } from './domain/ports';

@Module({
  imports: [DatabaseModule, QuizModule],
  controllers: [CategoryController, UserCategoryController],
  providers: [
    CategoryApplicationService,
    CategoryDomainService,
    CategoryRepository,
    { provide: CATEGORY_REPOSITORY_PORT, useClass: CategoryRepository },
  ],
  exports: [CategoryApplicationService, CATEGORY_REPOSITORY_PORT],
})
export class CategoryModule {}
