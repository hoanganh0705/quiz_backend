import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { TagController } from './tag.controller';
import { TagService } from './tag.service';

@Module({
  imports: [CommonModule],
  controllers: [TagController],
  providers: [TagService],
})
export class TagModule {}
