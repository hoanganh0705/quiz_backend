import { Injectable } from '@nestjs/common';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { AttemptService } from '../domain/attempt.service';
import { AttemptResponseMapper } from '../mappers/attempt-response.mapper';
import type { AttemptContextType } from '../types/attempt.types';
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
    private readonly attemptService: AttemptService,
    private readonly attemptResponseMapper: AttemptResponseMapper,
  ) {}

  async startAttempt(
    quizId: string,
    user: JwtPayload,
    payload: StartAttemptDto,
  ): Promise<AttemptResponseDto> {
    const result = await this.attemptService.startAttempt(
      quizId,
      user,
      payload.contextType ?? 'solo',
      payload.contextRefId ?? null,
    );

    return this.buildStartedAttemptResponse(result);
  }

  async getAttemptById(attemptId: string, user: JwtPayload): Promise<AttemptResponseDto> {
    const attempt = await this.attemptService.getAttemptById(attemptId, user);
    const answers = await this.attemptService.getAnswersByAttemptId(attemptId);

    return this.attemptResponseMapper.toAttemptDetailResponse(attempt, answers);
  }

  async submitAnswer(
    attemptId: string,
    questionId: string,
    selectedOptionId: string | null,
    timeTakenMs: number | null | undefined,
    user: JwtPayload,
  ): Promise<SubmitAnswerResponseDto> {
    const answer = await this.attemptService.submitAnswer(
      attemptId,
      questionId,
      selectedOptionId,
      user,
      timeTakenMs,
    );

    return this.attemptResponseMapper.toSubmitAnswerResponse(answer);
  }

  async abandonAttempt(attemptId: string, user: JwtPayload): Promise<AbandonAttemptResponseDto> {
    const attempt = await this.attemptService.abandonAttempt(attemptId, user);

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
    const rows = await this.attemptService.listMyAttempts(user, limit, cursor);

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
            ? Buffer.from(
                JSON.stringify({
                  startedAt: lastItem.startedAt,
                  attemptId: lastItem.attemptId,
                }),
              ).toString('base64')
            : null,
      },
    };
  }

  async completeAttempt(attemptId: string, user: JwtPayload): Promise<CompleteAttemptResponseDto> {
    const result = await this.attemptService.completeAttempt(attemptId, user);

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

  private buildStartedAttemptResponse(attempt: {
    attemptId: string;
    userId: string;
    quizVersionId: string;
    contextType: string;
    contextRefId: string | null;
    status: string;
    scorePercent: string | null;
    correctCount: number | null;
    startedAt: string;
    finishedAt: string | null;
    timeTakenMs: number | null;
    xpEarned: number;
  }): AttemptResponseDto {
    return {
      attemptId: attempt.attemptId,
      userId: attempt.userId,
      quizId: attempt.quizVersionId,
      quizTitle: '',
      quizSlug: '',
      versionNumber: 0,
      difficulty: '',
      durationMs: 0,
      passingScorePercent: 0,
      rewardXp: 0,
      contextType: attempt.contextType,
      contextRefId: attempt.contextRefId,
      status: attempt.status,
      scorePercent: attempt.scorePercent,
      correctCount: attempt.correctCount,
      startedAt: attempt.startedAt,
      finishedAt: attempt.finishedAt,
      timeTakenMs: attempt.timeTakenMs,
      xpEarned: attempt.xpEarned,
      answers: [],
    };
  }
}
