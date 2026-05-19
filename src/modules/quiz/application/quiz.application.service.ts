import { Injectable } from '@nestjs/common';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { QuizReadService } from '../domain/quiz/quiz-read.service';
import { QuizWriteService } from '../domain/quiz/quiz-write.service';
import { QuizVersionService } from '../domain/version/quiz-version.service';
import { QuizQuestionService } from '../domain/question/quiz-question.service';
import { QuizResponseMapper } from '../mappers/quiz-response.mapper';
import { QuizVersionResponseMapper } from '../mappers/quiz-version-response.mapper';
import { QuizQuestionResponseMapper } from '../mappers/quiz-question-response.mapper';
import { CreateQuizDto } from '../dto/request/create-quiz.dto';
import { ListQuizzesQueryDto } from '../dto/request/list-quizzes-query.dto';
import { CreateQuizVersionDto } from '../dto/request/create-quiz-version.dto';
import { ListQuizVersionsQueryDto } from '../dto/request/list-quiz-versions-query.dto';
import { UpdateQuizVersionDto } from '../dto/request/update-quiz-version.dto';
import { UpdateQuizDto } from '@/modules/quiz/dto/request/update-quiz.dto';
import { CreateQuizQuestionDto } from '@/modules/quiz/dto/request/create-quiz-question.dto';
import { QuizResponseDto } from '../dto/response/quiz-response.dto';
import { QuizListResponseDto } from '../dto/response/quiz-list-response.dto';
import { QuizVersionResponseDto } from '../dto/response/quiz-version-response.dto';
import { QuizVersionListResponseDto } from '../dto/response/quiz-version-list-response.dto';
import { DeleteQuizResponseDto } from '@/modules/quiz/dto/response/delete-quiz-response.dto';
import { QuizQuestionResponseDto } from '@/modules/quiz/dto/response/quiz-question-response.dto';

@Injectable()
export class QuizApplicationService {
  constructor(
    private readonly quizReadService: QuizReadService,
    private readonly quizWriteService: QuizWriteService,
    private readonly quizVersionService: QuizVersionService,
    private readonly quizQuestionService: QuizQuestionService,
    private readonly quizResponseMapper: QuizResponseMapper,
    private readonly quizVersionResponseMapper: QuizVersionResponseMapper,
    private readonly quizQuestionResponseMapper: QuizQuestionResponseMapper,
  ) {}

  async createQuiz(user: JwtPayload, payload: CreateQuizDto): Promise<QuizResponseDto> {
    const result = await this.quizWriteService.createQuiz(user, payload);
    return this.quizResponseMapper.toQuizResponse(result);
  }

  async listQuizzes(query: ListQuizzesQueryDto): Promise<QuizListResponseDto> {
    const result = await this.quizReadService.listQuizzes(query);

    return {
      items: result.rows.map((row) => this.quizResponseMapper.toQuizResponse(row)),
      pagination: {
        limit: result.limit,
        nextCursor: result.nextCursor,
        hasNextPage: result.hasNextPage,
      },
    };
  }

  async getQuizBySlug(slug: string): Promise<QuizResponseDto> {
    const { row, questions } = await this.quizReadService.getQuizBySlug(slug);

    const mappedQuestions = questions
      ? this.quizQuestionResponseMapper.toQuestionResponses(questions)
      : undefined;

    return this.quizResponseMapper.toQuizResponse(row, mappedQuestions);
  }

  async updateQuiz(
    quizId: string,
    user: JwtPayload,
    payload: UpdateQuizDto,
  ): Promise<QuizResponseDto> {
    const result = await this.quizWriteService.updateQuiz(quizId, user, payload);
    return this.quizResponseMapper.toQuizResponse(result);
  }

  async deleteQuiz(quizId: string, user: JwtPayload): Promise<DeleteQuizResponseDto> {
    return this.quizWriteService.softDeleteQuizById(quizId, user);
  }

  async createQuizVersion(
    quizId: string,
    user: JwtPayload,
    payload: CreateQuizVersionDto,
  ): Promise<QuizVersionResponseDto> {
    const result = await this.quizVersionService.createQuizVersion(quizId, user, payload);
    return this.quizVersionResponseMapper.toQuizVersionResponse(result);
  }

  async listQuizVersions(
    quizId: string,
    user: JwtPayload,
    query: ListQuizVersionsQueryDto,
  ): Promise<QuizVersionListResponseDto> {
    const result = await this.quizVersionService.listQuizVersions(quizId, user, query);

    return {
      items: result.rows.map((row) => this.quizVersionResponseMapper.toQuizVersionResponse(row)),
      pagination: {
        limit: result.limit,
        nextCursor: result.nextCursor,
        hasNextPage: result.hasNextPage,
      },
    };
  }

  async updateQuizVersion(
    quizVersionId: string,
    user: JwtPayload,
    payload: UpdateQuizVersionDto,
  ): Promise<QuizVersionResponseDto> {
    const result = await this.quizVersionService.updateQuizVersion(quizVersionId, user, payload);
    return this.quizVersionResponseMapper.toQuizVersionResponse(result);
  }

  async publishQuizVersion(
    quizVersionId: string,
    user: JwtPayload,
  ): Promise<QuizVersionResponseDto> {
    const result = await this.quizVersionService.publishQuizVersion(quizVersionId, user);
    return this.quizVersionResponseMapper.toQuizVersionResponse(result);
  }

  async createQuizQuestion(
    quizId: string,
    quizVersionId: string,
    user: JwtPayload,
    payload: CreateQuizQuestionDto,
  ): Promise<QuizQuestionResponseDto> {
    const rows = await this.quizQuestionService.createQuizQuestion(
      quizId,
      quizVersionId,
      user,
      payload,
    );

    const questions = this.quizQuestionResponseMapper.toQuestionResponses(rows);
    return questions[0];
  }
}
