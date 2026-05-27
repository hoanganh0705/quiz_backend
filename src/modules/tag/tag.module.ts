import { Module } from '@nestjs/common';
import { TagController } from './tag.controller';
import { TagApplicationService } from './application/tag.application.service';
import { TagDomainService } from './domain/tag.service';
import { TagRepository } from './infrastructure/repositories/tag.repository';
import { DatabaseModule } from '@/core/database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [TagController],
  providers: [TagApplicationService, TagDomainService, TagRepository],
  exports: [TagApplicationService],
})
export class TagModule {}
