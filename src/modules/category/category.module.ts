import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { CategoryService } from './category.service';
import { CategoryController } from './category.controller';

@Module({
  imports: [CommonModule],
  providers: [CategoryService],
  controllers: [CategoryController],
})
export class CategoryModule {}
