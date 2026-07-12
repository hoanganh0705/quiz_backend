import { Module } from '@nestjs/common';
import { CategoryController } from './transport/controllers/category.controller';
import { UserCategoryController } from './transport/controllers/user-category.controller';
import { CategoryApplicationService } from './application/category.application.service';
import { CategoryQueryService } from './application/category-query.service';
import { CategoryPresenter } from './transport/presenters/category.presenter';
import { CategoryDomainService } from './domain/category.service';
import { CategoryRepository } from './infrastructure/repositories/category.repository';
import { CategoryDomainEventBus } from './domain/events/category-domain.event-bus';
import { DatabaseModule } from '@/core/database/database.module';
import { QuizModule } from '@/modules/quiz/quiz.module';
import { CATEGORY_REPOSITORY_PORT, CATEGORY_DOMAIN_EVENT_BUS } from './domain/ports';
import { CategoryEventBootstrapService } from './category-event-bootstrap.service';

@Module({
  imports: [DatabaseModule, QuizModule],
  controllers: [CategoryController, UserCategoryController],
  providers: [
    CategoryApplicationService,
    CategoryQueryService,
    CategoryPresenter,
    CategoryDomainService,
    CategoryRepository,
    CategoryDomainEventBus,
    CategoryEventBootstrapService,
    { provide: CATEGORY_REPOSITORY_PORT, useClass: CategoryRepository },
    { provide: CATEGORY_DOMAIN_EVENT_BUS, useExisting: CategoryDomainEventBus },
  ],
  exports: [
    CategoryApplicationService,
    CategoryQueryService,
    CATEGORY_REPOSITORY_PORT,
    CATEGORY_DOMAIN_EVENT_BUS,
  ],
})
export class CategoryModule {}
