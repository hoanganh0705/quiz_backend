import { Module } from '@nestjs/common';
import { CategoryService } from './category.service';
import { CategoryController } from './category.controller';
import { DatabaseModule } from '@/core/database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [CategoryService],
  controllers: [CategoryController],
})
export class CategoryModule {}
