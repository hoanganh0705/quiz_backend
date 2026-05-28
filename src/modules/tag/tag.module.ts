import { Module } from '@nestjs/common';
import { TagController } from './tag.controller';
import { TagApplicationService } from './application/tag.application.service';
import { TagDomainService } from './domain/tag.service';
import { TagRepository } from './infrastructure/repositories/tag.repository';
import { DatabaseModule } from '@/core/database/database.module';
import { TAG_REPOSITORY_PORT } from './domain/ports/tag-repository.port';

@Module({
  imports: [DatabaseModule],
  controllers: [TagController],
  providers: [
    TagApplicationService,
    TagDomainService,
    TagRepository,
    { provide: TAG_REPOSITORY_PORT, useClass: TagRepository },
  ],
  exports: [TagApplicationService, TAG_REPOSITORY_PORT],
})
export class TagModule {}
