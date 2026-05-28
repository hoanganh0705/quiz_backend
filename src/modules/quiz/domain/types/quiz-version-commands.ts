import type { QuizDifficulty } from '../../types/quiz.types';

export type UpdateQuizVersionCommand = {
  difficulty?: QuizDifficulty;
  durationMs?: number;
  passingScorePercent?: number;
  rewardXp?: number;
};
