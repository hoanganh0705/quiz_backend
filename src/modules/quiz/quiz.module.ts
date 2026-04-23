import { Module } from '@nestjs/common';
import { QuizService } from './quiz.service';
import { QuizController } from './quiz.controller';
import { QuizVersionController } from './quiz-version.controller';
import { DatabaseModule } from '@/core/database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [QuizService],
  controllers: [QuizController, QuizVersionController],
})
export class QuizModule {}
