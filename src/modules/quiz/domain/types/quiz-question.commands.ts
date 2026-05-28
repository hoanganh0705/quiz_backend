export type AnswerOptionCommand = {
  position: number;
  value: string;
  isCorrect: boolean;
};

export type CreateQuizQuestionCommand = {
  quizVersionId: string;
  position: number;
  questionText: string;
  imageUrl: string | null;
  answerOptions: AnswerOptionCommand[];
};

export type CreateQuizQuestionsCommand = {
  quizVersionId: string;
  questions: {
    position: number;
    questionText: string;
    imageUrl: string | null;
    answerOptions: AnswerOptionCommand[];
  }[];
};
