import { Module } from '@nestjs/common';
import { CommonModule } from '@/common/common.module';
import { TagController } from './tag.controller';
import { TagService } from './tag.service';
import { DatabaseModule } from '@/core/database/database.module';

@Module({
  imports: [CommonModule, DatabaseModule],
  controllers: [TagController],
  providers: [TagService],
})
export class TagModule {}
