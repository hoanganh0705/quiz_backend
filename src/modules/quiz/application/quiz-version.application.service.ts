import { Inject, Injectable } from '@nestjs/common';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { QuizVersionService } from '../domain/version/quiz-version.service';
import { QuizVersionResponseMapper } from '../mappers/quiz-version-response.mapper';
import { QuizQuestionAuthorResponseMapper } from '../mappers/quiz-question-author-response.mapper';
import { QuizVersionCursorMapper } from '../mappers/quiz-cursor.mapper';
import { CreateQuizVersionDto } from '../dto/request/create-quiz-version.dto';
import { UpdateQuizVersionDto } from '../dto/request/update-quiz-version.dto';
import { ListQuizVersionsQueryDto } from '../dto/request/list-quiz-versions-query.dto';
import type {
  QuizVersionResponseDto,
  QuizVersionDetailResponseDto,
} from '../dto/response/quiz-version-response.dto';
import type { QuizVersionListResponseDto } from '../dto/response/quiz-version-list-response.dto';
import type { CreateQuizVersionCommand } from '../domain/types/create-quiz-version.command';
import type { UpdateQuizVersionCommand } from '../domain/types/quiz-version-commands';
import type { ListQuizVersionsQuery } from '../domain/types/list-quiz-versions.query';
import {
  QUIZ_REPOSITORY_PORT,
  type QuizRepositoryPort,
} from '../domain/ports/quiz-repository.port';

@Injectable()
export class QuizVersionApplicationService {
  constructor(
    private readonly quizVersionService: QuizVersionService,
    @Inject(QUIZ_REPOSITORY_PORT)
    private readonly quizRepository: QuizRepositoryPort,
  ) {}

  async createQuizVersion(
    quizId: string,
    user: JwtPayload,
    dto: CreateQuizVersionDto,
  ): Promise<QuizVersionResponseDto> {
    const command: CreateQuizVersionCommand = {
      difficulty: dto.difficulty,
      durationMs: dto.durationMs,
      passingScorePercent: dto.passingScorePercent,
      rewardXp: dto.rewardXp,
      sourceVersionId: dto.sourceVersionId,
    };
    const result = await this.quizVersionService.createQuizVersion(quizId, user, command);
    const questionCount =
      (await this.quizRepository.getQuestionCountsForVersionIds([result.quizVersionId])).get(
        result.quizVersionId,
      ) ?? 0;
    return QuizVersionResponseMapper.toQuizVersionResponse(result, questionCount);
  }

  async listQuizVersions(
    quizId: string,
    user: JwtPayload,
    dto: ListQuizVersionsQueryDto,
  ): Promise<QuizVersionListResponseDto> {
    const query: ListQuizVersionsQuery = {
      limit: dto.limit ?? 10,
      cursor: dto.cursor ? QuizVersionCursorMapper.parse(dto.cursor) : null,
    };
    const result = await this.quizVersionService.listQuizVersions(quizId, user, query);

    // Phase 2 (S-8): batch-fetch question counts so each item
    // exposes its `questionCount` without per-row aggregation.
    const versionIds = result.items.map((row) => row.quizVersionId);
    const counts = await this.quizRepository.getQuestionCountsForVersionIds(versionIds);

    return {
      items: result.items.map((row) =>
        QuizVersionResponseMapper.toQuizVersionResponse(row, counts.get(row.quizVersionId) ?? 0),
      ),
      pagination: {
        limit: result.limit,
        nextCursor: result.nextCursor ? QuizVersionCursorMapper.serialize(result.nextCursor) : null,
        hasNextPage: result.hasNextPage,
      },
    };
  }

  async getQuizVersionDetail(
    quizId: string,
    quizVersionId: string,
    user: JwtPayload,
  ): Promise<QuizVersionDetailResponseDto> {
    const { version, questions } = await this.quizVersionService.getQuizVersionDetail(
      quizId,
      quizVersionId,
      user,
    );

    return QuizVersionResponseMapper.toQuizVersionDetailResponse(
      version,
      QuizQuestionAuthorResponseMapper.toAuthorQuestionResponses(questions),
    );
  }

  async updateQuizVersion(
    quizId: string,
    quizVersionId: string,
    user: JwtPayload,
    dto: UpdateQuizVersionDto,
  ): Promise<QuizVersionResponseDto> {
    const command: UpdateQuizVersionCommand = {
      difficulty: dto.difficulty,
      durationMs: dto.durationMs,
      passingScorePercent: dto.passingScorePercent,
      rewardXp: dto.rewardXp,
    };
    const result = await this.quizVersionService.updateQuizVersion(
      quizId,
      quizVersionId,
      user,
      command,
    );
    const questionCount =
      (await this.quizRepository.getQuestionCountsForVersionIds([result.quizVersionId])).get(
        result.quizVersionId,
      ) ?? 0;
    return QuizVersionResponseMapper.toQuizVersionResponse(result, questionCount);
  }

  async publishQuizVersion(
    quizId: string,
    quizVersionId: string,
    user: JwtPayload,
  ): Promise<QuizVersionResponseDto> {
    const result = await this.quizVersionService.publishQuizVersion(quizId, quizVersionId, user);
    const questionCount =
      (await this.quizRepository.getQuestionCountsForVersionIds([result.quizVersionId])).get(
        result.quizVersionId,
      ) ?? 0;
    return QuizVersionResponseMapper.toQuizVersionResponse(result, questionCount);
  }
}
