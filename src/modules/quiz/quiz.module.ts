import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { QuizService } from './quiz.service';
import { QuizController } from './quiz.controller';

@Module({
  imports: [CommonModule],
  providers: [QuizService],
  controllers: [QuizController],
})
export class QuizModule {}
