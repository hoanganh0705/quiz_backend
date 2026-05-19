import { QuizAnswerOptionResponseDto } from './quiz-answer-option-response.dto';

export class QuizQuestionResponseDto {
  questionId!: string;
  quizVersionId!: string;
  position!: number;
  questionText!: string;
  imageUrl!: string | null;
  createdAt!: string;
  updatedAt!: string;
  answerOptions!: QuizAnswerOptionResponseDto[];
}
