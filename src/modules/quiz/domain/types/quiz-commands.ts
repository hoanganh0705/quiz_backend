import type { QuizDifficulty } from '../../types/quiz.types';

export type CreateQuizCommand = {
  creatorId: string;
  title: string;
  slug: string;
  description: string | null;
  requirements: string | null;
  imageUrl: string | null;
  imagePublicId: string | null;
  isFeatured: boolean;
  isHidden: boolean;
  initialVersion: {
    difficulty: QuizDifficulty;
    durationMs: number;
    passingScorePercent: number;
    rewardXp: number;
  };
  categoryId: string | null;
  tagIds: string[];
};

export type UpdateQuizCommand = {
  title?: string;
  description?: string | null;
  slug?: string;
  requirements?: string | null;
  imageUrl?: string | null;
  imagePublicId?: string | null;
  isFeatured?: boolean;
  isHidden?: boolean;
  categoryId?: string | null;
  tagIds?: string[] | null;
};
