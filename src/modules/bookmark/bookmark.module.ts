import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/core/database/database.module';
import { LoggerModule } from 'nestjs-pino';
import { BookmarkApplicationService } from './application/bookmark.application.service';
import { BookmarkService } from './domain/bookmark.service';
import { BookmarkResponseMapper } from './mappers/bookmark-response.mapper';
import { BookmarkController } from './transport/controller/bookmark.controller';
import { BookmarkDomainExceptionFilter } from './transport/filters/bookmark-domain-exception.filter';
import { BOOKMARK_REPOSITORY_PORT } from './domain/ports';
import { BookmarkRepository } from '@/core/database/repositories/bookmark.repository';
import { QuizModule } from '@/modules/quiz/quiz.module';

@Module({
  imports: [DatabaseModule, LoggerModule.forRoot(), QuizModule],
  providers: [
    // Application
    BookmarkApplicationService,

    // Domain
    BookmarkService,

    // Mapper
    BookmarkResponseMapper,

    // Exception filter
    BookmarkDomainExceptionFilter,

    // Port bindings
    { provide: BOOKMARK_REPOSITORY_PORT, useExisting: BookmarkRepository },
  ],
  controllers: [BookmarkController],
  exports: [BookmarkApplicationService],
})
export class BookmarkModule {}
