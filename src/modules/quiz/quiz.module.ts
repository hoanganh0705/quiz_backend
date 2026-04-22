import { Module } from '@nestjs/common';
import { CommonModule } from '@/common/common.module';
import { QuizService } from './quiz.service';
import { QuizController } from './quiz.controller';
import { QuizVersionController } from './quiz-version.controller';
import { DatabaseModule } from '@/core/database/database.module';

@Module({
  imports: [CommonModule, DatabaseModule],
  providers: [QuizService],
  controllers: [QuizController, QuizVersionController],
})
export class QuizModule {}
