import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { CategoryService } from './category.service';
import { CategoryController } from './category.controller';
import { DatabaseModule } from '../../core/database/database.module';

@Module({
  imports: [CommonModule, DatabaseModule],
  providers: [CategoryService],
  controllers: [CategoryController],
})
export class CategoryModule {}
