export type QuizQuestionJoinRow = {
  questionId: string;
  quizVersionId: string;
  position: number;
  questionText: string;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
  optionId: string | null;
  optionPosition: number | null;
  optionValue: string | null;
  optionIsCorrect: boolean | null;
  optionCreatedAt: string | null;
};

export interface QuizQuestionRepositoryPort {
  getQuestionsByVersionId(quizVersionId: string): Promise<QuizQuestionJoinRow[]>;
  getQuestionById(questionId: string): Promise<QuizQuestionJoinRow[]>;
  getQuestionsByIds(questionIds: string[]): Promise<QuizQuestionJoinRow[]>;
  createQuestionWithOptions(params: {
    quizVersionId: string;
    position: number;
    questionText: string;
    imageUrl: string | null;
    createdAt: string;
    updatedAt: string;
    answerOptions: {
      position: number;
      value: string;
      isCorrect: boolean;
      createdAt: string;
    }[];
  }): Promise<{ questionId: string }>;
  createQuestionsWithOptions(
    params: {
      quizVersionId: string;
      position: number;
      questionText: string;
      imageUrl: string | null;
      createdAt: string;
      updatedAt: string;
      answerOptions: {
        position: number;
        value: string;
        isCorrect: boolean;
        createdAt: string;
      }[];
    }[],
  ): Promise<{ questionIds: string[] }>;
}

export const QUIZ_QUESTION_REPOSITORY_PORT = Symbol('QUIZ_QUESTION_REPOSITORY_PORT');
