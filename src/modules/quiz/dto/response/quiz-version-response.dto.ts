import { QuizDifficulty, QuizVersionStatus } from '@/modules/quiz/types/quiz.types';
import { QuizQuestionResponseDto } from './quiz-question-response.dto';

export class QuizVersionResponseDto {
  quizVersionId!: string;
  quizId!: string;
  versionNumber!: number;
  status!: QuizVersionStatus;
  difficulty!: QuizDifficulty;
  durationMs!: number;
  passingScorePercent!: number;
  rewardXp!: number;
  createdByUserId!: string | null;
  createdAt!: string;
  publishedAt!: string | null;
  archivedAt!: string | null;
  updatedAt!: string;
  questions?: QuizQuestionResponseDto[];
}
