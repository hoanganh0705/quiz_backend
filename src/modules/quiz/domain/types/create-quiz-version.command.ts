import type { QuizDifficulty } from '../../types/quiz.types';

export type CreateQuizVersionCommand = {
  difficulty: QuizDifficulty;
  durationMs: number;
  passingScorePercent: number;
  rewardXp: number;
  sourceVersionId?: string;
};
