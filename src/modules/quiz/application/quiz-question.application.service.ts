import { Injectable } from '@nestjs/common';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { QuizQuestionService } from '../domain/question/quiz-question.service';
import { QuizQuestionAuthorResponseMapper } from '../mappers/quiz-question-author-response.mapper';
import { CreateQuizQuestionDto } from '../dto/request/create-quiz-question.dto';
import { CreateQuizQuestionsDto } from '../dto/request/create-quiz-questions.dto';
import type { QuizQuestionAuthorDto } from '../dto/response/quiz-question-author.dto';
import type { BulkQuizQuestionsResponseDto } from '../dto/response/bulk-quiz-questions-response.dto';
import type { CreateQuizQuestionCommand, CreateQuizQuestionsCommand } from '../domain/types';

@Injectable()
export class QuizQuestionApplicationService {
  constructor(private readonly quizQuestionService: QuizQuestionService) {}

  async createQuizQuestion(
    quizId: string,
    quizVersionId: string,
    user: JwtPayload,
    dto: CreateQuizQuestionDto,
  ): Promise<QuizQuestionAuthorDto> {
    const command: CreateQuizQuestionCommand = {
      quizVersionId,
      position: dto.position,
      questionText: dto.questionText,
      imageUrl: dto.imageUrl ?? null,
      answerOptions: dto.answerOptions.map((option) => ({
        position: option.position,
        value: option.value,
        isCorrect: option.isCorrect,
      })),
    };
    const rows = await this.quizQuestionService.createQuizQuestion(
      quizId,
      quizVersionId,
      user,
      command,
    );
    const responses = QuizQuestionAuthorResponseMapper.toAuthorQuestionResponses(rows);
    return responses[0];
  }

  async createQuizQuestions(
    quizId: string,
    quizVersionId: string,
    user: JwtPayload,
    dto: CreateQuizQuestionsDto,
  ): Promise<BulkQuizQuestionsResponseDto> {
    const command: CreateQuizQuestionsCommand = {
      quizVersionId,
      questions: dto.questions.map((question) => ({
        position: question.position,
        questionText: question.questionText,
        imageUrl: question.imageUrl ?? null,
        answerOptions: question.answerOptions.map((option) => ({
          position: option.position,
          value: option.value,
          isCorrect: option.isCorrect,
        })),
      })),
    };
    const rows = await this.quizQuestionService.createQuizQuestions(
      quizId,
      quizVersionId,
      user,
      command,
    );
    return {
      questions: QuizQuestionAuthorResponseMapper.toAuthorQuestionResponses(rows),
    };
  }
}
