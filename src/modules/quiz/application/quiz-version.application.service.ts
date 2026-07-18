import { Injectable } from '@nestjs/common';
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

@Injectable()
export class QuizVersionApplicationService {
  constructor(private readonly quizVersionService: QuizVersionService) {}

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
    return QuizVersionResponseMapper.toQuizVersionResponse(result);
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

    return {
      items: result.rows.map((row) => QuizVersionResponseMapper.toQuizVersionResponse(row)),
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
    return QuizVersionResponseMapper.toQuizVersionResponse(result);
  }

  async publishQuizVersion(
    quizId: string,
    quizVersionId: string,
    user: JwtPayload,
  ): Promise<QuizVersionResponseDto> {
    const result = await this.quizVersionService.publishQuizVersion(quizId, quizVersionId, user);
    return QuizVersionResponseMapper.toQuizVersionResponse(result);
  }
}
