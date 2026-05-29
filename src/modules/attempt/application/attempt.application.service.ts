import { Injectable } from '@nestjs/common';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { encodeBase64JsonCursor } from '@/common/utils/cursor.util';
import { AttemptCommandService } from '../domain/attempt-command.service';
import { AttemptQueryService } from '../domain/attempt-query.service';
import { AttemptResponseMapper } from '../mappers/attempt-response.mapper';
import { StartAttemptDto } from '../dto/request';
import {
  AttemptResponseDto,
  AttemptListResponseDto,
  SubmitAnswerResponseDto,
  AbandonAttemptResponseDto,
  CompleteAttemptResponseDto,
} from '../dto/response';

@Injectable()
export class AttemptApplicationService {
  constructor(
    private readonly attemptCommandService: AttemptCommandService,
    private readonly attemptQueryService: AttemptQueryService,
    private readonly attemptResponseMapper: AttemptResponseMapper,
  ) {}

  async startAttempt(
    quizId: string,
    user: JwtPayload,
    payload: StartAttemptDto,
  ): Promise<AttemptResponseDto> {
    const attempt = await this.attemptCommandService.startAttempt(
      quizId,
      user,
      payload.contextType ?? 'solo',
      payload.contextRefId ?? null,
    );

    const detail = await this.attemptQueryService.getAttemptById(attempt.attemptId, user);
    const answers = await this.attemptQueryService.getAnswersByAttemptId(attempt.attemptId);

    return this.attemptResponseMapper.toAttemptDetailResponse(detail, answers);
  }

  async getAttemptById(attemptId: string, user: JwtPayload): Promise<AttemptResponseDto> {
    const attempt = await this.attemptQueryService.getAttemptById(attemptId, user);
    const answers = await this.attemptQueryService.getAnswersByAttemptId(attemptId);

    return this.attemptResponseMapper.toAttemptDetailResponse(attempt, answers);
  }

  async submitAnswer(
    attemptId: string,
    questionId: string,
    selectedOptionId: string | null,
    timeTakenMs: number | null | undefined,
    user: JwtPayload,
  ): Promise<SubmitAnswerResponseDto> {
    const answer = await this.attemptCommandService.submitAnswer(
      attemptId,
      questionId,
      selectedOptionId,
      user,
      timeTakenMs,
    );

    return this.attemptResponseMapper.toSubmitAnswerResponse(answer);
  }

  async abandonAttempt(attemptId: string, user: JwtPayload): Promise<AbandonAttemptResponseDto> {
    const attempt = await this.attemptCommandService.abandonAttempt(attemptId, user);

    return {
      attemptId: attempt.attemptId,
      status: attempt.status,
      finishedAt: attempt.finishedAt ?? new Date().toISOString(),
      message: 'Attempt abandoned successfully',
    };
  }

  async listMyAttempts(
    user: JwtPayload,
    limit: number,
    cursor?: { startedAt: string; attemptId: string } | null,
  ): Promise<AttemptListResponseDto> {
    const rows = await this.attemptQueryService.listMyAttempts(user, limit, cursor);

    const hasNextPage = rows.length > limit;
    const items = hasNextPage ? rows.slice(0, limit) : rows;
    const lastItem = items.at(-1);

    return {
      items: this.attemptResponseMapper.toAttemptResponses(items),
      pagination: {
        limit,
        hasNextPage,
        nextCursor:
          hasNextPage && lastItem
            ? encodeBase64JsonCursor({
                startedAt: lastItem.startedAt,
                attemptId: lastItem.attemptId,
              })
            : null,
      },
    };
  }

  async completeAttempt(attemptId: string, user: JwtPayload): Promise<CompleteAttemptResponseDto> {
    const result = await this.attemptCommandService.completeAttempt(attemptId, user);

    return {
      attemptId: result.attemptId,
      quizId: result.quizId,
      status: result.status,
      scorePercent: result.scorePercent,
      correctCount: result.correctCount,
      timeTakenMs: result.timeTakenMs,
      xpEarned: result.xpEarned,
      finishedAt: result.finishedAt ?? new Date().toISOString(),
    };
  }
}
