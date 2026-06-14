import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { QuizAnalyticsService } from '@/modules/quiz/domain/analytics';
import {
  CATEGORY_DOMAIN_EVENT_BUS,
  type CategoryDomainEventBusPort,
} from '@/modules/category/domain/ports';

/**
 * Wires CategoryDomainEventBus events to QuizAnalyticsService.
 *
 * This service exists at the application layer to bridge the Category module
 * and the Quiz module without creating a hard dependency between them.
 *
 * On module init, it subscribes to category lifecycle events and triggers
 * analytics recalculation for all quizzes in the affected category.
 */
@Injectable()
export class CategoryEventBootstrapService implements OnModuleInit {
  constructor(
    @Inject(CATEGORY_DOMAIN_EVENT_BUS)
    private readonly categoryEventBus: CategoryDomainEventBusPort,
    private readonly quizAnalyticsService: QuizAnalyticsService,
    @InjectPinoLogger(CategoryEventBootstrapService.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    this.categoryEventBus.subscribe((event) => {
      this.handleEvent(event as CategoryDomainEventPayload);
    });
  }

  private handleEvent(event: CategoryDomainEventPayload): void {
    const { type, categoryId } = event;

    try {
      switch (type) {
        case 'CategoryCreatedEvent':
          this.logger.info({ event: 'category_event_bootstrap_created', categoryId });
          break;
        case 'CategoryUpdatedEvent':
          this.logger.info({ event: 'category_event_bootstrap_updated', categoryId });
          void this.quizAnalyticsService.invalidateCategoryAnalytics(categoryId);
          break;
        case 'CategoryDeletedEvent':
          this.logger.info({ event: 'category_event_bootstrap_deleted', categoryId });
          void this.quizAnalyticsService.invalidateCategoryAnalytics(categoryId);
          break;
        case 'CategoryRestoredEvent':
          this.logger.info({ event: 'category_event_bootstrap_restored', categoryId });
          void this.quizAnalyticsService.invalidateCategoryAnalytics(categoryId);
          break;
      }
    } catch (error) {
      this.logger.error({
        event: 'category_event_bootstrap_handler_failed',
        type,
        categoryId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

type CategoryDomainEventPayload =
  | { type: 'CategoryCreatedEvent'; categoryId: string; slug: string; nowIso: string }
  | { type: 'CategoryUpdatedEvent'; categoryId: string; slug: string; nowIso: string }
  | { type: 'CategoryDeletedEvent'; categoryId: string; slug: string; nowIso: string }
  | { type: 'CategoryRestoredEvent'; categoryId: string; slug: string; nowIso: string };
