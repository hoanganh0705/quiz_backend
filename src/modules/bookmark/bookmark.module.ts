import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/core/database/database.module';
import { BookmarkApplicationService } from './application/bookmark.application.service';
import { BookmarkQueryService } from './domain/bookmark-query.service';
import { BookmarkCommandService } from './domain/bookmark-command.service';
import { BookmarkResponseMapper } from './mappers/bookmark-response.mapper';
import { BookmarkStatsResponseMapper } from './mappers/bookmark-stats-response.mapper';
import { BookmarkController } from './transport/controller/bookmark.controller';
import { BookmarkPresenter } from './transport/presenters/bookmark.presenter';
import { BOOKMARK_REPOSITORY_PORT } from './domain/ports';
import { BookmarkRepository } from './infrastructure/repositories/bookmark.repository';
import { QuizModule } from '@/modules/quiz/quiz.module';
import {
  BOOKMARK_DOMAIN_EVENT_BUS,
  BookmarkDomainEventBus,
} from './domain/events/bookmark-domain.event-bus';
import { BookmarkAnalyticsEventHandler } from './domain/events/bookmark-analytics-event-handler.service';

@Module({
  imports: [DatabaseModule, QuizModule],
  providers: [
    // Application
    BookmarkApplicationService,

    // Domain — CQRS split
    BookmarkQueryService,
    BookmarkCommandService,

    // Infrastructure
    BookmarkRepository,

    // Event Bus
    BookmarkDomainEventBus,

    // Port binding: BOOKMARK_DOMAIN_EVENT_BUS → BookmarkDomainEventBus
    { provide: BOOKMARK_DOMAIN_EVENT_BUS, useExisting: BookmarkDomainEventBus },

    // Analytics bridge: subscribes to bookmark events → refreshes quiz metrics
    BookmarkAnalyticsEventHandler,

    // Port bindings
    { provide: BOOKMARK_REPOSITORY_PORT, useExisting: BookmarkRepository },

    // Mapper
    BookmarkResponseMapper,
    BookmarkStatsResponseMapper,

    // Presentation
    BookmarkPresenter,
  ],
  controllers: [BookmarkController],
  exports: [BookmarkApplicationService, BOOKMARK_REPOSITORY_PORT, BOOKMARK_DOMAIN_EVENT_BUS],
})
export class BookmarkModule {}
