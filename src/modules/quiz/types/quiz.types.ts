export type QuizDifficulty = 'easy' | 'medium' | 'hard';

export type QuizVersionStatus = 'draft' | 'published' | 'archived';

export type QuizCursorPayload = {
  createdAt: string;
  quizId: string;
};

export type QuizVersionCursorPayload = {
  createdAt: string;
  quizVersionId: string;
};

export type CreateQuizLinkIds = string[];
